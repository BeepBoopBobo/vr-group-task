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

  const [activeMenuOpt, setActiveMenuOpt] = useState<menuOptions>(menuOptions.distance);

  const [mapPoints, setMapPoints] = useState<mapPoint[]>([
    { label: "first-point", coords: { lat: null, long: null } },
    { label: "second-point", coords: { lat: null, long: null } },
    { label: "third-point", coords: { lat: null, long: null } },
  ]);
  const [distanceBetweenPoints, setDistanceBetweenPoints] = useState<number | null>(null);


  const [isUsingKilometers, setIsUsingKilometers] = useState(true);
  const [isUsingDegrees, setIsUsingDegrees] = useState(true);

  useEffect(() => {
    console.log("effect", mapPoints);
  }, [mapPoints]);


  useEffect(() => {
    if (mapElement.current && !mapRef.current) {
      const vectorLayer = new VectorLayer({
        source: vectorSourceRef.current,
      });

      mapRef.current = new Map({
        view: new View({
          center: [0, 0],
          zoom: 0,
        }),
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        target: mapElement.current,
      });

      mapRef.current.on('click', handleMapClick);
    }
  }, []);

  const calculateDistance = (point1: coords, point2: coords): number => {
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);
    return getLength(line);
  };

  const drawLine = (point1: coords, point2: coords) => {
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
    vectorSourceRef.current.clear();
    vectorSourceRef.current.addFeature(lineFeature);
  };

  const handleMapClick = (event: any) => {
    const coords = event.coordinate;
    const [lon, lat] = toLonLat(coords);

    switch (activeMenuOpt) {
      case menuOptions.distance:
        setMapPoints((prevState) => {
          const newPoints = [...prevState];
          if (newPoints[0].coords.lat === null) {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };
          } else if (newPoints[1].coords.lat === null) {
            newPoints[1] = { ...newPoints[1], coords: { lat: lat, long: lon } };
            const distance = calculateDistance(newPoints[0].coords, { lat, long: lon });
            setDistanceBetweenPoints(distance);
            drawLine({ ...newPoints[0].coords }, { lat: lat, long: lon });
          } else {
            newPoints[0] = { ...newPoints[0], coords: { lat: lat, long: lon } };
            newPoints[1] = { ...newPoints[1], coords: { lat: null, long: null } };
          }
          return newPoints;
        });
        break;
      case menuOptions.angle:
      case menuOptions.freeDraw:
        break;
    }
  };

  const handleDistanceInput = (e: any) => {
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

    if (mapPoints[0].coords.lat !== null && mapPoints[0].coords.long !== null &&
      mapPoints[1].coords.lat !== null && mapPoints[1].coords.long !== null) {
      setDistanceBetweenPoints(calculateDistance(mapPoints[0].coords, mapPoints[1].coords));
      drawLine(mapPoints[0].coords, mapPoints[1].coords);
    } else {
      setDistanceBetweenPoints(null);
      vectorSourceRef.current.clear();
    }
  }

  const renderMenuOptions = () => {
    return Object.values(menuOptions).map((option, index) => (
      <button
        key={index}
        value={option}
        onClick={() => setActiveMenuOpt(option)}
        className={"menu-tab" + activeMenuOpt === option ? 'active-tab' : ''}
      >
        {option}
      </button>
    ));
  };

  const renderMenuContent = () => {
    switch (activeMenuOpt) {
      case "Measure line":
        return renderLineMenu();
      case "Measure angle":
        return renderAngleMenu();
      case "Free draw":
        return renderDrawMenu();
    }
  }

  const renderLatLongInput = (ind: number, type: string) => {
    const inputId = ind === 0 ? `first-point-${type}` : ind === 1 ? `second-point-${type}` : `third-point-${type}`;
    return <label>
      {type === "lat" ? "Latitude: " : "Longitude: "}
      <input
        value={(type === "lat" ? mapPoints[ind].coords.lat : mapPoints[ind].coords.long) || ''}
        max={type === "lat" ? "90" : "180"}
        min={type === "lat" ? "-90" : "-180"}
        type='number'
        id={inputId}
        onChange={handleDistanceInput} />
    </label>
  }
  const renderLineMenu = () => {
    let displayedDistance;
    if (isUsingKilometers === true) {
      displayedDistance = <p>Distance: {(distanceBetweenPoints ? (distanceBetweenPoints / 1000).toFixed(2) : "N/A")} km</p>
    } else {
      displayedDistance = <p>Distance: {(distanceBetweenPoints ? (distanceBetweenPoints * 0.0006213711922).toFixed(2) : "N/A")} miles</p>
    }


    return <>
      <h2>Line Information:</h2>
      { }
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
        {displayedDistance}
      </div>
    </>
  }
  const renderAngleMenu = () => {
    return <></>
  }
  const renderDrawMenu = () => {
    return <></>

  }
  return (
    <div className="App">
      <div className="Menu">
        <div className="Menu-options">
          {renderMenuOptions()}
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