import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Feature, Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM, Vector as VectorSource } from 'ol/source.js';
import { getLength } from 'ol/sphere.js';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import { LineString } from 'ol/geom';
import Draw from 'ol/interaction/Draw';
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
  const pointsRef = useRef<coords[]>([]);
  const drawRef = useRef<Draw>();
  const drawingDoneRef = useRef<boolean>(false);

  const [isUsingKilometers, setIsUsingKilometers] = useState(true);
  const [isUsingDegrees, setIsUsingDegrees] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

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
    pointsRef.current = [];
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
      //check if there are at least two points, if so check if the last two clicks were at the same point
      //on the map, if so dont add the last click
      if (newState.length > 1 &&
        newState[newState.length - 1].lat === newState[newState.length - 2].lat &&
        newState[newState.length - 1].long === newState[newState.length - 2].long) {
        pointsRef.current = prevState;
        return prevState;
      } else if (drawingDoneRef.current === true) {
        resetMapPoints();
        pointsRef.current = [];
        return [];
      } else {
        pointsRef.current = newState;
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
    pointsRef.current = newPoints;
    setMapPoints(newPoints);
    renderUpdatedLine();
  }

  const renderUpdatedLine = () => {
    const coords = mapPoints.map((point) => fromLonLat([point.long!, point.lat!]));

    if (vectorSourceRef.current.getFeatures().length === 0) {
      const feature = new Feature(new LineString(coords));
      vectorSourceRef.current.addFeature(feature);
    } else {
      const feature = vectorSourceRef.current.getFeatures()[0];
      feature.setGeometry(new LineString(coords));
    }
  }

  const renderMenuOptions = () => {
    let menuTabs = <div className='menu-tabs' key="tabs">
      <button className={`menu-tab ` + (activeMenuOpt === menuOptions.distance ? 'active-tab' : '')} onClick={() => { setActiveMenuOpt(menuOptions.distance) }} >{menuOptions.distance}</button>
      <button className={`menu-tab ` + (activeMenuOpt === menuOptions.freeDraw ? 'active-tab' : '')} onClick={() => { setActiveMenuOpt(menuOptions.freeDraw) }} >{menuOptions.freeDraw}</button>
    </div>

    let menuOpt = activeMenuOpt === "Measure lines" ? <div className='menu-checkboxes' key="checkboxes">
      <label className='menu-checkbox'>
        <input type='checkbox' defaultChecked={isUsingKilometers} onClick={() => setIsUsingKilometers(!isUsingKilometers)} />Use Kilometers
      </label>
      <label className='menu-checkbox'>
        <input type='checkbox' defaultChecked={isUsingDegrees} onClick={() => setIsUsingDegrees(!isUsingDegrees)} />Use Degrees
      </label>
    </div> : <></>

    return [menuTabs, menuOpt];
  };

  const renderMenuContent = () => {
    if (activeMenuOpt === menuOptions.distance) {
      return renderLineMenu();
    }
    else if (activeMenuOpt === menuOptions.freeDraw) {
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
      pointsRef.current = newState;
      return newState;
    });
  }

  const renderAddPointBtn = () => {
    return <button className='btn' onClick={addPointInput}>Add Point</button>
  }

  const deletePoint = (index: number) => {
    const newState = pointsRef.current.filter(point => pointsRef.current.indexOf(point) !== index);

    pointsRef.current = newState;
    setMapPoints(pointsRef.current);

    const coords = pointsRef.current.map((point) => fromLonLat([point.long!, point.lat!]));
    const feature = vectorSourceRef.current.getFeatures()[0];
    feature.setGeometry(new LineString(coords));
  }

  const renderLineMenu = () => {
    let totalDistance = 0;

    const points = mapPoints.map((point, index) => {
      let distanceBetweenLastTwo = 0;
      let angle = null;

      if (mapPoints[index - 1]) {
        distanceBetweenLastTwo = calculateDistance(point, mapPoints[index - 1])
      }
      if (mapPoints[index - 2]) {
        let angleBetweenLastTwo = calculateAngle(mapPoints[index], mapPoints[index - 1], mapPoints[index - 2]);

        angle = isUsingDegrees === true ?
          `${(angleBetweenLastTwo * (180 / Math.PI)).toFixed(2)}°` :
          `${angleBetweenLastTwo.toFixed(2)} Rad`;
      }

      let distance = isUsingKilometers ?
        `${distanceBetweenLastTwo} KM` :
        `${distanceBetweenLastTwo} Miles`;

      totalDistance += distanceBetweenLastTwo || 0;

      return <div key={index} className='point-container'>
        <h3 className='point-tag'>Point #{index}</h3>
        <div className='point-info'>
          <div className='point-inputs'>
            <label>
              Lat:
              <input
                value={point.lat || 0}
                max="90"
                min="-90"
                type='number'
                id={`${index}-x`}
                key={`${index}-x`}
                className='point-input'
                onChange={(e) => handleLinePointInput(e, index, "x")} />
            </label>

            <label>
              Long:
              <input
                value={point.long || 0}
                max="180"
                min="-180"
                type='number'
                id={`${index}-y`}
                key={`${index}-y`}
                className='point-input'

                onChange={(e) => handleLinePointInput(e, index, "y")} />
            </label>
          </div>
          <p className='point-measurement'>
            Angle between adjacent points: <span className='bold'>{angle || "NaN"}</span>
          </p>
          <p className='point-measurement'>
            Distance from previous point: <span className='bold'>{distance}</span>
          </p>
          <button className='delete-btn' onClick={() => { deletePoint(index) }}>Delete</button>
        </div>
      </div>
    });

    return <>
      <h2>Line Information:</h2>
      {points}
      <h4>
        Total Distance: <span className='bold'>
          {isUsingKilometers ? `${parseFloat((totalDistance).toFixed(2))} KM` : `${parseFloat((totalDistance).toFixed(2))} Miles`}
        </span>
      </h4>
      <div className='point-control-btns'>
        {renderAddPointBtn()}
        {renderResetBtn()}
      </div>
    </>
  }

  const renderResetBtn = () => {
    if (mapPoints.length > 0) {
      return <button className='btn' onClick={resetMapPoints}>Reset</button>
    }
  }

  const renderDrawMenu = () => {
    return <>{renderResetBtn()}</>
  }
  const renderToggleMenuBtn = () => {
    return <button className='btn toggle-menu-btn' onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? "Close Menu" : "Open Menu"}</button>
  }
  const renderMenu = () => {
    return isMenuOpen === true ? <div className="menu">
      <div className="menu-options">
        {renderMenuOptions()}
      </div>
      <div className='menu-content'>
        {renderMenuContent()}
      </div>
    </div> : <></>;
  }

  return (
    <div className="App">
      {renderToggleMenuBtn()}
      {renderMenu()}

      <div className="map" ref={mapElement}></div>
    </div>
  );
}

export default App;