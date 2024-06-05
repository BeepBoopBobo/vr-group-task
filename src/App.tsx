import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Feature, Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { getLength } from 'ol/sphere.js';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style.js';
import VectorLayer from 'ol/layer/Vector';
import { LineString, MultiLineString } from 'ol/geom';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import * as olCoordinate from 'ol/coordinate';
import { Console } from 'console';
import { reset } from 'ol/transform';
interface coords {
  lat: number | null,
  long: number | null,
}

enum menuOptions { distance = "Measure lines", freeDraw = "Free draw" };

function App() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const vectorSourceRef = useRef<VectorSource>(new VectorSource());

  const [activeMenuOpt, setActiveMenuOpt] = useState<menuOptions>(menuOptions.distance);

  const [mapPoints, setMapPoints] = useState<coords[]>([]);
  const mapPointsRef = useRef(mapPoints);
  const drawRef = useRef<Draw>();
  const drawingDoneRef = useRef<boolean>(false);

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
          zoom: 1,
        }),
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        target: mapElement.current,
      });
      addInteractionToMap();
    }
  }, []);

  useEffect(() => {
    resetMapPoints();
    mapRef.current?.addEventListener('click', handleMapClick);

    return () => {
      mapRef.current?.removeEventListener('click', handleMapClick);
    }
  }, [activeMenuOpt])

  const resetMapPoints = () => {
    drawingDoneRef.current = false;
    vectorSourceRef.current.clear();

    if (drawRef.current !== undefined) {
      mapRef.current?.removeInteraction(drawRef.current);
      drawRef.current = undefined;
    }

    setMapPoints([]);
    addInteractionToMap();
  }

  const addInteractionToMap = () => {
    switch (activeMenuOpt) {
      case "Measure lines":
        if (drawRef.current === undefined) {
          drawRef.current = new Draw({
            source: vectorSourceRef.current,
            type: "LineString",
          });
          mapRef.current?.addInteraction(drawRef.current);
          drawRef.current.on("drawend", () => { drawingDoneRef.current = true; });
        }
        break;
      case "Free draw":
        if (drawRef.current === undefined) {
          drawRef.current = new Draw({
            source: vectorSourceRef.current,
            type: "Polygon",
          });
          mapRef.current?.addInteraction(drawRef.current);
        }
        break;
    }
  };

  const handleMapClick = (event: any) => {
    const coords = event.coordinate;
    const [lon, lat] = toLonLat(coords);

    setMapPoints((prevState) => {
      const newState = [...prevState, { lat: parseFloat(lat.toFixed(2)), long: parseFloat(lon.toFixed(2)) }];
      mapPointsRef.current = newState;
      //check if there are at least two points, if so check if the last two clicks were at the same point
      //on the map, if so dont add the last click
      if (newState.length > 1 &&
        newState[newState.length - 1].lat === newState[newState.length - 2].lat &&
        newState[newState.length - 1].long === newState[newState.length - 2].long) {
        return prevState;
      } else if (drawingDoneRef.current === true) {
        resetMapPoints();
        return [];
      } else {
        return newState;
      }
    });

  };

  const handleLinePointInput = (e: any, index: number, pos: string) => {
    const { value } = e.target;
    const floatValue = parseFloat(value);
    const newPoints = [...mapPoints];
    if (pos === 'x') {
      newPoints[index].lat = floatValue;
    } else {
      newPoints[index].long = floatValue;
    }
    setMapPoints(newPoints);

    const coords = newPoints.map((point) => fromLonLat([point.long!, point.lat!]));
    const feature = vectorSourceRef.current.getFeatures()[0];
    feature.setGeometry(new LineString(coords));
  }

  const renderMenuOptions = () => {
    return Object.values(menuOptions).map((option, index) => (
      <button
        key={index}
        value={option}
        onClick={() => { setActiveMenuOpt(option) }}
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
      case menuOptions.freeDraw:
        return renderDrawMenu();
    }
  }

  const calculateDistance = (point1: coords, point2: coords): number => {
    const coord1 = fromLonLat([point1.long!, point1.lat!]);
    const coord2 = fromLonLat([point2.long!, point2.lat!]);
    const line = new LineString([coord1, coord2]);
    const distance = getLength(line);
    if (isUsingKilometers) {
      return parseFloat((distance / 1000).toFixed(2));
    } else {
      return parseFloat((distance * 0.0006213711922).toFixed(2));
    }
  };
  const calculateAngle = (point1: coords, point2: coords, point3: coords): number => {

    const a = Math.sqrt(Math.pow(point3.lat! - point2.lat!, 2) + Math.pow(point3.long! - point2.long!, 2));
    const b = Math.sqrt(Math.pow(point3.lat! - point1.lat!, 2) + Math.pow(point3.long! - point1.long!, 2));
    const c = Math.sqrt(Math.pow(point2.lat! - point1.lat!, 2) + Math.pow(point2.long! - point1.long!, 2));

    return Math.acos((a * a + c * c - b * b) / (2 * a * c));
  };

  const addPointInput = () => {
    setMapPoints((prevState) => {
      const newState = [...prevState, { lat: null, long: null }];
      return newState;
    });
  }

  const renderAddPointBtn = () => {
    return <button onClick={addPointInput}>Add Point</button>
  }

  const renderLineMenu = () => {
    let totalDistance = 0;

    const points = mapPoints.map((point, index) => {
      let distanceBetweenLastTwo = 0;
      let angle = <p>Angle: NaN</p>;

      if (mapPoints[index - 1]) {
        distanceBetweenLastTwo = calculateDistance(point, mapPoints[index - 1])
      }
      if (mapPoints[index - 2]) {
        let angleBetweenLastTwo = calculateAngle(mapPoints[index], mapPoints[index - 1], mapPoints[index - 2]);
        angle = <p>Angle: {isUsingDegrees === true ?
          `${(angleBetweenLastTwo * (180 / Math.PI)).toFixed(2)}°` :
          `${angleBetweenLastTwo.toFixed(2)} Rad`}</p>;
      }

      let distance = <p>Distance {isUsingKilometers ?
        `${distanceBetweenLastTwo} KM` :
        `${distanceBetweenLastTwo} Miles`}</p>;
      totalDistance += distanceBetweenLastTwo || 0;

      return <div key={index}>
        <p>Point #{index}</p>
        <label>
          X:
          <input
            value={point.lat!}
            max="90"
            min="-90"
            type='number'
            id={`${index}-x`}
            key={`${index}-x`}
            onChange={(e) => handleLinePointInput(e, index, "x")} />
        </label>

        <label>
          Y:
          <input
            value={point.long!}
            max="180"
            min="-180"
            type='number'
            id={`${index}-y`}
            key={`${index}-y`}
            onChange={(e) => handleLinePointInput(e, index, "y")} />
        </label>
        <div>
          {angle}
        </div>
        <div>
          {distance}
        </div>
      </div>
    });

    return <>
      <div>
        <button className={"measurement-opt" + (isUsingKilometers === true ? 'active-opt' : '')} onClick={() => setIsUsingKilometers(true)}>Use Kilometers</button>
        <button className={"measurement-opt" + (isUsingKilometers === true ? '' : 'active-opt')} onClick={() => setIsUsingKilometers(false)}>Use Miles</button>
      </div>
      <div>
        <button className={"measurement-opt" + (isUsingDegrees === true ? 'active-opt' : '')} onClick={() => setIsUsingDegrees(true)}>Use Degrees</button>
        <button className={"measurement-opt" + (isUsingDegrees === true ? '' : 'active-opt')} onClick={() => setIsUsingDegrees(false)}>Use Rads</button>
      </div>
      <h2>Line Information:</h2>
      {points}
      Total Distance: {isUsingKilometers ? `${parseFloat((totalDistance).toFixed(2))} KM` : `${parseFloat((totalDistance).toFixed(2))} Miles`}
      {renderAddPointBtn()}
    </>
  }

  const renderResetBtn = () => {
    if (drawRef.current !== undefined) {
      return <button onClick={resetMapPoints}>Reset</button>
    }
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
          {renderResetBtn()}
        </div>
      </div>
      <div className="Map" ref={mapElement}></div>
    </div>
  );
}

export default App;