import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Feature, Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { getLength } from 'ol/sphere.js';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style.js';
import VectorLayer from 'ol/layer/Vector';
import { LineString } from 'ol/geom';

interface coords {
  lat: number | null,
  long: number | null,
}

interface mapPoint {
  coords: coords,
  label: string,
}
enum menuOptions { distance = "Measure line", angle = "Measure angle", freeDraw = "Free draw" };

function App() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());

  const [activeMenuOpt, setActiveMenuOpt] = useState<menuOptions>(menuOptions.angle);

  const [mapPoints, setMapPoints] = useState<mapPoint[]>([
    { label: "first-point", coords: { lat: null, long: null } },
    { label: "second-point", coords: { lat: null, long: null } },
    { label: "third-point", coords: { lat: null, long: null } },
  ]);
  const [distanceBetweenPoints, setDistanceBetweenPoints] = useState<number | null>(null);

  const [isUsingKilometers, setIsUsingKilometers] = useState(true);
  const [isUsingDegrees, setIsUsingDegrees] = useState(true);

  useEffect(() => {
    if (mapElement.current && !mapRef.current) {
      const vectorLayer = new VectorLayer({
        source: vectorSourceRef.current,
      });

      mapRef.current = new Map({
        view: new View({
          center: [0, 0],
          zoom: 10,
        }),
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        target: mapElement.current,
      });
    }
  }, []);

  useEffect(() => {
    mapRef.current?.addEventListener('click', handleMapClick);
    return () => {
      mapRef.current?.removeEventListener('click', handleMapClick);
    }
  }, [activeMenuOpt])


  const calculateDistance = (point1: coords, point2: coords): number => {
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);
    return getLength(line);
  };

  const drawLine = (point1: coords, point2: coords, clear: boolean) => {
    console.log("drawing new line");
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);

    const lineFeature = new Feature({
      geometry: line
    });

    lineFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#ffcc33',
          width: 5
        })
      })
    );
    if (clear) {
      vectorSourceRef.current.clear();
    }
    vectorSourceRef.current.addFeature(lineFeature);
  };

  const clearMapPoints = () => {
    clearMapLines();
    setMapPoints((prevState) => {
      return prevState.map(point => {
        return { ...point, coords: { lat: null, long: null } }
      });
    })
  }

  const handleMapClick = (event: any) => {
    const coords = event.coordinate;
    const [lon, lat] = toLonLat(coords);

    switch (activeMenuOpt) {
      case "Measure line":
        setMapPoints((prevState) => {
          const newPoints = [...prevState];
          if (newPoints[0].coords.lat === null) {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };
          } else if (newPoints[1].coords.lat === null) {
            newPoints[1] = { ...newPoints[1], coords: { lat: lat, long: lon } };
            const distance = calculateDistance(newPoints[0].coords, { lat, long: lon });
            setDistanceBetweenPoints(distance);
            drawLine({ ...newPoints[0].coords }, { lat: lat, long: lon }, true);
          } else {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };
            newPoints[1] = { ...newPoints[1], coords: { lat: null, long: null } };
          }
          return newPoints;
        });
        break;

      case "Measure angle":
        setMapPoints((prevState) => {
          const newPoints = [...prevState];
          if (newPoints[0].coords.lat === null) {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };

          } else if (newPoints[1].coords.lat === null) {
            newPoints[1] = { ...newPoints[1], coords: { lat: lat, long: lon } };
            drawLine({ ...newPoints[0].coords }, { lat: lat, long: lon }, true);

          } else if (newPoints[2].coords.lat === null) {
            newPoints[2] = { ...newPoints[2], coords: { lat: lat, long: lon } };
            drawLine({ ...newPoints[0].coords }, { ...newPoints[1].coords }, true);
            drawLine({ ...newPoints[1].coords }, { lat: lat, long: lon }, false);

          } else {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };
            newPoints[1] = { ...newPoints[1], coords: { lat: null, long: null } };
            newPoints[2] = { ...newPoints[2], coords: { lat: null, long: null } };
          }
          return newPoints;
        });
        break;
      case "Free draw":
        console.log(" >case freeDraw >>> ", menuOptions.freeDraw);

        break;
    }
  };


  const clearMapLines = () => {
    vectorSourceRef.current.clear();
  }
  const handleLinePointInput = (e: any) => {
    const { id, value } = e.target;
    const floatValue = parseFloat(value);

    setMapPoints((prevState) => {
      return prevState.map(point => {
        if (id.includes(point.label) && id.includes('-lat')) {
          return { ...point, coords: { ...point.coords, lat: floatValue } };
        } else if (id.includes(point.label) && id.includes('-long')) {
          return { ...point, coords: { ...point.coords, long: floatValue } };
        }
        return point;
      })
    })

    if (mapPoints[2].coords.lat !== null && mapPoints[2].coords.long !== null) {
      drawLine(mapPoints[0].coords, mapPoints[1].coords, true);
      drawLine(mapPoints[1].coords, mapPoints[2].coords, false);
    }
    else if (mapPoints[0].coords.lat !== null && mapPoints[0].coords.long !== null &&
      mapPoints[1].coords.lat !== null && mapPoints[1].coords.long !== null) {
      setDistanceBetweenPoints(calculateDistance(mapPoints[0].coords, mapPoints[1].coords));
      drawLine(mapPoints[0].coords, mapPoints[1].coords, true);
    } else {
      setDistanceBetweenPoints(null);
      clearMapLines();
    }
  }

  const renderMenuOptions = () => {
    return Object.values(menuOptions).map((option, index) => (
      <button
        key={index}
        value={option}
        onClick={() => { setActiveMenuOpt(option); clearMapPoints(); }}
        className={"menu-tab" + activeMenuOpt === option ? 'active-tab' : ''}
      >
        {option}
      </button>
    ));
  };

  const renderMenuContent = () => {
    switch (activeMenuOpt) {
      case menuOptions.distance:
        return renderLineMenu();
      case menuOptions.angle:
        return renderAngleMenu();
      case menuOptions.freeDraw:
        return renderDrawMenu();
    }
  }

  const renderLatLongInput = (ind: number, type: string) => {
    const inputId = ind === 0 ? `first-point-${type}` : ind === 1 ? `second-point-${type}` : `third-point-${type}`;

    if (ind === 2) { }
    const value = (type === "lat" ? mapPoints[ind].coords.lat : mapPoints[ind].coords.long) || '';

    return <label>
      {type === "lat" ? "Latitude: " : "Longitude: "}
      <input
        value={value}
        max={type === "lat" ? "90" : "180"}
        min={type === "lat" ? "-90" : "-180"}
        type='number'
        id={inputId}
        onChange={handleLinePointInput} />
    </label>
  }

  const renderAngle = () => {
    const A = mapPoints[0].coords,
      B = mapPoints[1].coords,
      C = mapPoints[2].coords;

    if (!A.lat || !A.long || !B.lat || !B.long || !C.lat || !C.long) {
      return <p>Angle: NaN°</p>;
    }

    const a = Math.sqrt(Math.pow(C.lat - B.lat, 2) + Math.pow(C.long - B.long, 2));
    const b = Math.sqrt(Math.pow(C.lat - A.lat, 2) + Math.pow(C.long - A.long, 2));
    const c = Math.sqrt(Math.pow(B.lat - A.lat, 2) + Math.pow(B.long - A.long, 2));

    const beta = Math.acos((a * a + c * c - b * b) / (2 * a * c));

    if (isUsingDegrees === true) {
      return <p>Angle: {(beta * (180 / Math.PI)).toFixed(2)}°</p>;
    } else {
      return <p>Angle: {beta.toFixed(2)}Rad</p>;
    }
  };

  const renderLineMenu = () => {
    let displayedDistance;
    if (isUsingKilometers === true) {
      displayedDistance = <p>Distance: {(distanceBetweenPoints ? (distanceBetweenPoints / 1000).toFixed(2) : "N/A")} km</p>
    } else {
      displayedDistance = <p>Distance: {(distanceBetweenPoints ? (distanceBetweenPoints * 0.0006213711922).toFixed(2) : "N/A")} miles</p>
    }

    return <>
      <h2>Line Information:</h2>
      <div>
        <h3>Starting Point</h3>
        {renderLatLongInput(0, "lat")}
        {renderLatLongInput(0, "long")}
      </div>

      <div>
        <h3>Ending Point</h3>
        {renderLatLongInput(1, "lat")}
        {renderLatLongInput(1, "long")}

        <div>
          <button className={"measurement-opt" + (isUsingKilometers === true ? 'active-opt' : '')} onClick={() => setIsUsingKilometers(true)}>Use Kilometers</button>
          <button className={"measurement-opt" + (isUsingKilometers === true ? '' : 'active-opt')} onClick={() => setIsUsingKilometers(false)}>Use Miles</button>
        </div>
      </div>
      {displayedDistance}
    </>
  }
  const renderAngleMenu = () => {
    return <>
      <h2>Line Information:</h2>
      <div>
        <h3>Starting Point</h3>
        {renderLatLongInput(0, "lat")}
        {renderLatLongInput(0, "long")}
      </div>

      <div>
        <h3>Middle Point</h3>
        {renderLatLongInput(1, "lat")}
        {renderLatLongInput(1, "long")}
      </div>

      <div>
        <h3>Ending Point</h3>
        {renderLatLongInput(2, "lat")}
        {renderLatLongInput(2, "long")}
      </div>

      <div>
        <div>
          <button className={"measurement-opt" + (isUsingDegrees === true ? 'active-opt' : '')} onClick={() => setIsUsingDegrees(true)}>Use Degrees</button>
          <button className={"measurement-opt" + (isUsingDegrees === true ? '' : 'active-opt')} onClick={() => setIsUsingDegrees(false)}>Use Rads</button>
        </div>
        {renderAngle()}
      </div>
    </>
  }
  const renderDrawMenu = () => {
    return <></>

  }
  return (
    <div className="App">
      <div className="Menu">
        <div className="Menu-options">
          {renderMenuOptions()}
          active: {activeMenuOpt}
        </div>
        <div className='Menu-content'>
          {renderMenuContent()}
        </div>
      </div>
      <div className="Map" ref={mapElement}></div>
    </div>
  );
}

export default App;