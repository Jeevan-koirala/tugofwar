const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.use(express.static(path.join(__dirname, 'public')))

const TUG_LIMIT = 100
const PULL_MIN = 1
const PULL_MAX = 25
const PULL_COOLDOWN_MS = 80
const RESET_DELAY_MS = 3000

let state = { ropePosition: 0, players: {}, lastWinner: null }
let leaderboard = { Red: 0, Blue: 0 }

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
function broadcastState() {
  io.emit('state', {
    ropePosition: state.ropePosition,
    players: Object.values(state.players).map(p => ({ name: p.name, team: p.team })),
    lastWinner: state.lastWinner,
    leaderboard
  })
}

io.on('connection', socket => {
  socket.emit('init', { ropePosition: state.ropePosition, leaderboard })
  socket.on('join', data => {
    const name = data && data.name ? String(data.name).slice(0, 24) : `P-${socket.id.slice(0, 4)}`
    const pref = data && data.preferred ? String(data.preferred).toLowerCase() : 'auto'
    const counts = Object.values(state.players).reduce((acc, p) => { acc[p.team] = (acc[p.team] || 0) + 1; return acc }, { red: 0, blue: 0 })
    let team = 'red'
    if (pref === 'red' || pref === 'blue') team = pref
    else team = counts.red <= counts.blue ? 'red' : 'blue'
    state.players[socket.id] = { id: socket.id, name, team, lastPullAt: 0 }
    broadcastState()
  })

  socket.on('pull', data => {
    const player = state.players[socket.id]
    if (!player) return
    const now = Date.now()
    if (now - (player.lastPullAt || 0) < PULL_COOLDOWN_MS) return
    player.lastPullAt = now
    const raw = Number(data && data.strength) || 6
    const strength = clamp(Math.round(raw), PULL_MIN, PULL_MAX)
    const direction = player.team === 'red' ? 1 : -1
    state.ropePosition += direction * strength
    state.ropePosition *= 0.996
    state.ropePosition = clamp(state.ropePosition, -TUG_LIMIT, TUG_LIMIT)
    if (state.ropePosition >= TUG_LIMIT) {
      state.ropePosition = TUG_LIMIT
      state.lastWinner = 'Red'
      leaderboard.Red = (leaderboard.Red || 0) + 1
      io.emit('win', { winner: 'Red' })
      broadcastState()
      setTimeout(() => { state.ropePosition = 0; state.lastWinner = null; broadcastState() }, RESET_DELAY_MS)
      return
    }
    if (state.ropePosition <= -TUG_LIMIT) {
      state.ropePosition = -TUG_LIMIT
      state.lastWinner = 'Blue'
      leaderboard.Blue = (leaderboard.Blue || 0) + 1
      io.emit('win', { winner: 'Blue' })
      broadcastState()
      setTimeout(() => { state.ropePosition = 0; state.lastWinner = null; broadcastState() }, RESET_DELAY_MS)
      return
    }
    broadcastState()
  })

  socket.on('leave', () => {
    delete state.players[socket.id]
    broadcastState()
  })

  socket.on('resetLeaderboard', () => {
    leaderboard = { Red: 0, Blue: 0 }
    broadcastState()
  })

  socket.on('disconnect', () => {
    delete state.players[socket.id]
    broadcastState()
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
