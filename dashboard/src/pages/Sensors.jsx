import { Droplets, Thermometer } from 'lucide-react';
import { useStore, useWindowReadings } from '../lib/store.jsx';
import { useRange } from '../lib/hooks.js';
import { fmt } from '../lib/format.js';
import { Card, Grid, PageHeader, RangeSelect, Stat } from '../components/ui.jsx';
import { TimeChart } from '../components/TimeChart.jsx';

export default function Sensors() {
  const { latest } = useStore();
  const { key, setKey, ms } = useRange('15m');
  const rows = useWindowReadings(ms);
  const mag = latest ? Math.sqrt(latest.accel_x ** 2 + latest.accel_y ** 2 + latest.accel_z ** 2) : null;
  return (
    <>
      <PageHeader title="Sensor Monitoring" subtitle="Live readings from the DHT11 and MPU6500"><RangeSelect value={key} onChange={setKey} /></PageHeader>
      <Grid cols={5}>
        <Stat icon={Thermometer} label="Temperature" value={fmt(latest?.temperature)} unit="°C" />
        <Stat icon={Droplets} label="Humidity" value={fmt(latest?.humidity)} unit="%" />
        <Stat label="Accel X" value={fmt(latest?.accel_x, 3)} unit="g" />
        <Stat label="Accel Y" value={fmt(latest?.accel_y, 3)} unit="g" />
        <Stat label="Accel Z" value={fmt(latest?.accel_z, 3)} unit="g" sub={`|a| = ${fmt(mag, 3)} g`} />
      </Grid>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Temperature history"><TimeChart data={rows} series={[{ key: 'temperature', label: 'Temperature' }]} unit="°C" /></Card>
        <Card title="Humidity history"><TimeChart data={rows} series={[{ key: 'humidity', label: 'Humidity' }]} unit="%" /></Card>
        <Card title="Acceleration vs. time" className="lg:col-span-2">
          <TimeChart data={rows} unit="g" digits={3} height={280}
            series={[{ key: 'accel_x', label: 'X' }, { key: 'accel_y', label: 'Y' }, { key: 'accel_z', label: 'Z' }]} />
        </Card>
      </div>
    </>
  );
}
