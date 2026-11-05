// Embedded MQTT broker (aedes) so no separate Mosquitto install is needed.
import pkg from 'aedes';
import net from 'node:net';

export function startBroker(port = 1883) {
  const aedes = typeof pkg === 'function' ? pkg() : (pkg.Aedes ? new pkg.Aedes() : pkg.default());
  const srv = net.createServer(aedes.handle);
  srv.on('error', (e) => console.error(`Embedded broker failed on :${port} (${e.code}). Is Mosquitto already running? Start without --broker.`));
  srv.listen(port, () => console.log(`Embedded MQTT broker on :${port}`));
  return srv;
}
