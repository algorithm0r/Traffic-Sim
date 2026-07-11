'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS.
var gameEngine, world, dataManager, db;

function reset() {
  gameEngine.clear();
  world = new World();
  const cv = gameEngine.ctx.canvas;
  const speed = new LineGraph(20, cv.height - 160, 330, 140, 'mean speed (mph)');
  const fd = new ScatterGraph(380, cv.height - 160, 330, 140,
                              'flow (veh/h/ln) vs density (veh/km/ln)', 0, 80, 0, 2600);
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, { speed, fd });
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  gameEngine.add(speed);
  gameEngine.add(fd);
}

function toggleColor() {
  PARAMETERS.colorMode = PARAMETERS.colorMode === 'speed' ? 'type' : 'speed';
  const b = document.getElementById('colorBtn');
  if (b) b.textContent = 'Color: ' + PARAMETERS.colorMode;
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
  setInterval(function () {
    if (!world) return;
    const m = world.metrics();
    setStatus('t ' + (world.time / 60).toFixed(1) + ' min | ' + m.count + ' veh | ' +
              (m.meanV * MS2MPH).toFixed(0) + ' mph | ' +
              m.density.toFixed(1) + ' veh/km/ln | queue ' + m.queueTotal +
              ' | exited ' + m.stats.exited);
  }, 500);
};
