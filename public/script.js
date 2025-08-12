const socket = (typeof io !== 'undefined') ? io() : null

const menu = document.getElementById('menu')
const menuName = document.getElementById('menuName')
const menuMult = document.getElementById('menuMult')
const menuBot = document.getElementById('menuBot')
const teamRedBtn = document.getElementById('teamRed')
const teamBlueBtn = document.getElementById('teamBlue')
const menuBotDiff = document.getElementById('menuBotDiff')
const startBtn = document.getElementById('startBtn')

const game = document.getElementById('game')
const leftArea = document.getElementById('leftArea')
const rightArea = document.getElementById('rightArea')
const pullBtn = document.getElementById('pullBtn')
const statusEl = document.getElementById('status')
const ropeWrap = document.getElementById('ropeWrap')
const meterFill = document.getElementById('meterFill')
const topRedCount = document.getElementById('topRedCount')
const topBlueCount = document.getElementById('topBlueCount')
const lbRed = document.getElementById('lbRed')
const lbBlue = document.getElementById('lbBlue')
const leaveBtn = document.getElementById('leaveBtn')
const backBtn = document.getElementById('backBtn')
const winBanner = document.getElementById('winBanner')
const particlesCanvas = document.getElementById('particles')

let chosenMode = 'multiplayer'
let chosenTeam = 'red'
let chosenDiff = 'medium'
let joined = false
let myName = ''
let myTeam = null
let ropePos = 0
const TUG_LIMIT = 100

particlesCanvas.width = window.innerWidth
particlesCanvas.height = window.innerHeight
const pctx = particlesCanvas.getContext('2d')
let particles = []

function spawnParticle(x,y,team){
  particles.push({
    x,y,
    vx:(Math.random()-0.5)*6,
    vy:-Math.random()*6-2,
    life:Math.random()*60+40,
    size:Math.random()*3+1,
    color: team==='red' ? 'rgba(255,100,100,0.9)' : 'rgba(100,150,255,0.9)'
  })
}

function stepParticles(){
  pctx.clearRect(0,0,particlesCanvas.width,particlesCanvas.height)
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]
    p.x+=p.vx
    p.y+=p.vy
    p.vy+=0.12
    p.life--
    pctx.fillStyle=p.color
    pctx.beginPath()
    pctx.arc(p.x,p.y,p.size,0,Math.PI*2)
    pctx.fill()
    if(p.life<=0||p.y>particlesCanvas.height+50) particles.splice(i,1)
  }
  requestAnimationFrame(stepParticles)
}
requestAnimationFrame(stepParticles)

teamRedBtn.classList.add('selected')
menuMult.classList.add('active')
document.querySelector('.bot-row')?.classList.add('hidden')

function setTeam(t){
  chosenTeam=t
  if(t==='red'){ teamRedBtn.classList.add('selected'); teamBlueBtn.classList.remove('selected') }
  else { teamBlueBtn.classList.add('selected'); teamRedBtn.classList.remove('selected') }
}

function setMode(m){
  chosenMode = m
  if(m==='bot'){
    menuBot.classList.add('active'); menuMult.classList.remove('active')
    document.querySelector('.bot-row')?.classList.remove('hidden')
  } else {
    menuMult.classList.add('active'); menuBot.classList.remove('active')
    document.querySelector('.bot-row')?.classList.add('hidden')
  }
}

menuMult.onclick=()=>{
  setMode('multiplayer')
}
menuBot.onclick=()=>{
  setMode('bot')
}
teamRedBtn.onclick=()=>setTeam('red')
teamBlueBtn.onclick=()=>setTeam('blue')
menuBotDiff.onchange=()=> chosenDiff = menuBotDiff.value

startBtn.onclick=()=>{
  myName = menuName.value.trim() || `Player${Math.floor(Math.random()*900+100)}`
  myTeam = chosenTeam
  openGame()
}

function openGame(){
  menu.classList.add('hidden')
  game.classList.remove('hidden')
  setMode(chosenMode)
  if(chosenMode==='multiplayer') joinIfMulti()
  else startBots(chosenDiff)
  statusEl.textContent = `Ready — Pull to play!`
  statusEl.style.color = ''
}

leaveBtn.onclick=()=>{
  leaveIfMulti()
  stopBots()
  game.classList.add('hidden')
  menu.classList.remove('hidden')
  winBanner.classList.add('hidden')
}
backBtn.onclick=()=>{ location.reload() }

function joinIfMulti(){
  if(chosenMode!=='multiplayer') return
  if(socket) socket.emit('join',{ preferred: chosenTeam, name: myName })
  joined=true
  myTeam=chosenTeam
  statusEl.textContent = `Joined ${myTeam.toUpperCase()} as ${myName}`
  statusEl.style.color = ''
}

function leaveIfMulti(){
  if(joined && socket) socket.emit('leave')
  joined=false
  myTeam=null
}

let botTimers=[]
function startBots(diff){
  stopBots()
  const bots = diff==='easy' ? [{team:'blue',interval:700}] : diff==='hard' ? [{team:'blue',interval:260},{team:'red',interval:300}] : [{team:'blue',interval:450},{team:'red',interval:520}]
  bots.forEach(b=>{
    const id = setInterval(()=>{
      if(Math.random()<0.9) localPull(b.team, 4 + Math.random()*6)
      const rect = ropeWrap.getBoundingClientRect()
      spawnParticle(rect.left+rect.width/2 + (b.team==='red'?-20:20)+(Math.random()*30-15), rect.top+10+Math.random()*20, b.team)
    }, b.interval)
    botTimers.push(id)
  })
}
function stopBots(){ botTimers.forEach(t=>clearInterval(t)); botTimers=[] }

function localPull(team, strength){
  ropePos += (team==='red' ? 1 : -1) * Math.round(strength)
  ropePos *= 0.996
  ropePos = Math.max(-TUG_LIMIT, Math.min(TUG_LIMIT, ropePos))
  renderRope(ropePos)
  checkLocalWin()
}

function checkLocalWin(){
  if(ropePos >= TUG_LIMIT){ handleLocalWin('Red') }
  else if(ropePos <= -TUG_LIMIT){ handleLocalWin('Blue') }
}

function handleLocalWin(w){
  spawnBurstAtRope(w.toLowerCase(), 120)
  showWin(w)
  setTimeout(()=>{ ropePos = 0; renderRope(ropePos) }, 1400)
}

function spawnBurstAtRope(team,count=80){
  const rect = ropeWrap.getBoundingClientRect()
  for(let i=0;i<count;i++) spawnParticle(rect.left + rect.width/2 + (Math.random()*60-30), rect.top + rect.height/2 + (Math.random()*40-20), team)
}

function doPull(){
  const rect = ropeWrap.getBoundingClientRect()
  const x = rect.left + rect.width/2 + (Math.random()*40-20)
  const y = rect.top + rect.height/2 + (Math.random()*20-10)
  spawnParticle(x,y, myTeam || (Math.random()>0.5 ? 'red' : 'blue'))
  animatePullVisual(myTeam)
  if(chosenMode==='multiplayer'){
    if(!joined){ statusEl.textContent='Join a team first!'; statusEl.style.color='#c33'; return }
    if(socket) socket.emit('pull',{ strength: 6 })
  } else {
    localPull(myTeam || (Math.random()>0.5 ? 'red' : 'blue'), 6)
  }
  statusEl.style.color = ''
}

pullBtn.onclick=doPull
leftArea.addEventListener('touchstart',(e)=>{ e.preventDefault(); doPullFromSide('red') })
rightArea.addEventListener('touchstart',(e)=>{ e.preventDefault(); doPullFromSide('blue') })
leftArea.addEventListener('mousedown',()=> doPullFromSide('red'))
rightArea.addEventListener('mousedown',()=> doPullFromSide('blue'))

function doPullFromSide(side){
  const teamSide = side==='red' ? 'red' : 'blue'
  if(chosenMode==='multiplayer'){
    if(!joined){ statusEl.textContent='Join a team first!'; statusEl.style.color='#c33'; return }
    if(socket) socket.emit('pull',{ strength: 6 })
  } else {
    localPull(teamSide, 6)
  }
  const r = ropeWrap.getBoundingClientRect()
  spawnParticle(r.left + r.width/2 + (teamSide==='red' ? -10 : 10), r.top + 8 + Math.random()*10, teamSide)
  animatePullVisual(teamSide)
}

function animatePullVisual(team){
  const rv = document.querySelector('.rope-visual')
  if(!rv) return
  rv.style.transition='transform .09s cubic-bezier(.2,.85,.2,1)'
  rv.style.transform = `rotate(${team==='red'?-2:2}deg) scaleX(1.01)`
  setTimeout(()=>{ rv.style.transform=''; rv.style.transition='' }, 110)
}

function renderRope(val){
  ropePos = Math.max(-TUG_LIMIT, Math.min(TUG_LIMIT, val))
  const pct = 50 + (ropePos / TUG_LIMIT) * 50
  const clampPct = Math.max(2, Math.min(98, pct))
  meterFill.style.width = `${clampPct}%`
  const arenaRect = ropeWrap.getBoundingClientRect()
  const maxShift = Math.min(120, arenaRect.width * 0.25)
  const shiftX = -(ropePos / TUG_LIMIT) * maxShift
  ropeWrap.style.transform = `translateX(${shiftX}px)`
}

if(socket){
  socket.on('connect', ()=>{ statusEl.textContent='Connected to server'; statusEl.style.color=''; })
  socket.on('init', d=>{ if(d && typeof d.ropePosition==='number') renderRope(d.ropePosition); if(d && d.leaderboard){ lbRed.textContent=d.leaderboard.Red||0; lbBlue.textContent=d.leaderboard.Blue||0 } })
  socket.on('state', d=>{ if(chosenMode!=='multiplayer') return; if(d && typeof d.ropePosition==='number'){ renderRope(d.ropePosition) } if(d && Array.isArray(d.players)){ let r=0,b=0; d.players.forEach(p=> p.team==='red'? r++ : b++); topRedCount.textContent=r; topBlueCount.textContent=b } if(d && d.leaderboard){ lbRed.textContent=d.leaderboard.Red||0; lbBlue.textContent=d.leaderboard.Blue||0 } })
  socket.on('win', d=>{ if(chosenMode!=='multiplayer') return; if(d && d.winner) showWin(d.winner) })
  socket.on('disconnect', ()=>{ statusEl.textContent='Disconnected. Retrying...'; statusEl.style.color='#c33' })
}

function showWin(team){
  winBanner.classList.remove('hidden')
  winBanner.textContent = `${team.toUpperCase()} WINS!`
  winBanner.classList.toggle('red', team.toLowerCase()==='red')
  winBanner.classList.toggle('blue', team.toLowerCase()==='blue')
  const rect = ropeWrap.getBoundingClientRect()
  spawnBurstAtRope(team.toLowerCase(), 120)
  document.body.animate([{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],{duration:420,iterations:1})
  setTimeout(()=>{ winBanner.classList.add('hidden') }, 2600)
}

window.addEventListener('keydown', e=>{
  if(e.key===' '||e.key==='Enter'){ e.preventDefault(); doFakeTap() }
})
function doFakeTap(){
  const w = window.innerWidth
  const x = w/2 + (Math.random()*200 - 100)
  if(x < w/2) doPullFromSide('red')
  else doPullFromSide('blue')
}

window.addEventListener('resize', ()=>{ particlesCanvas.width = window.innerWidth; particlesCanvas.height = window.innerHeight })
