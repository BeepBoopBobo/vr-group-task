import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Feature, Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import Draw from 'ol/interaction/Draw';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { getLength } from 'ol/sphere.js';
import { fromLonLat, toLonLat } from 'ol/proj';

import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';
import VectorLayer from 'ol/layer/Vector';
import { LineString } from 'ol/geom';
interface line {
  firstPointCords: [number | null, number | null],
  secondPointCords: [number | null, number | null],
  distanceBetweenPoints: number | null,
}
function App() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const [mapLine, setLine] = useState<line>({ firstPointCords: [null, null], secondPointCords: [null, null], distanceBetweenPoints: null });

  const style = new Style({
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.2)',
    }),
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.5)',
      lineDash: [10, 10],
      width: 2,
    }),
    image: new CircleStyle({
      radius: 5,
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.7)',
      }),
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
    }),
  });

  let draw: any;

  useEffect(() => {
    if (mapElement.current && !mapRef.current) {
      const vectorLayer = new VectorLayer({
        source: vectorSourceRef.current,
      });

      mapRef.current = new Map({
        target: mapElement.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        view: new View({
          center: fromLonLat([0, 0]),
          zoom: 2,
        }),
      });

      const draw = new Draw({
        source: vectorSourceRef.current,
        type: 'LineString',
        maxPoints: 2,
      });

      draw.on('drawstart', (event) => {
        // Clear previous drawings
        vectorSourceRef.current.clear();
        setLine({
          firstPointCords: [0, 0],
          secondPointCords: [0, 0],
          distanceBetweenPoints: 0,
        });
      });

      draw.on('drawend', (event) => {
        const feature = event.feature;
        const geom = feature.getGeometry() as LineString;
        const coords = geom.getCoordinates();
        if (coords.length >= 2) {
          const [first, second] = coords.map(coord => toLonLat(coord) as [number, number]);
          const distance = getLength(geom);
          setLine({
            firstPointCords: first,
            secondPointCords: second,
            distanceBetweenPoints: distance / 1000, // Convert to kilometers
          });

          // Create a new feature for the drawn line to ensure it's displayed
          const lineFeature = new Feature(new LineString(coords));
          lineFeature.setStyle(
            new Style({
              stroke: new Stroke({
                color: '#ffcc33',
                width: 2,
              }),
            })
          );
          vectorSourceRef.current.addFeature(lineFeature);
        }
      });

      mapRef.current.addInteraction(draw);
    }
  }, []);

  return (
    <div className="App">
      <div className="Menu">
        <h2>Line Information:</h2>
        <p>First Point: {mapLine.firstPointCords.join(', ')}</p>
        <p>Second Point: {mapLine.secondPointCords.join(', ')}</p>
        <p>Distance: {mapLine.distanceBetweenPoints?.toFixed(2)} m</p>
      </div>
      <div className="Map" ref={mapElement}></div>
    </div>
  );
}

export default App;

