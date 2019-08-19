const fs = require('fs');
const readline = require('readline');
const http = require('http');

//Global variables
const dataRefreshRate = 1.5 * 60000 ; //minutes (x * 60000 ms)
const defaultNoOfKeys = 59;
let actualNoOfKeys = defaultNoOfKeys;
let cityCache = {};
let totalPetits = 0;

//Regresa un arreglo con las ciudades de origen - destino
function readCSVFileByLine(fileName, callback) {
    let cities = [];
    let petitionNum = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(fileName) });

    rl.on('line', function(line) {
        if (/([A-Z]{3},){2}(-?\d+\.?\d+,?){3}-?\d+\.?\d+/.test(line)) {
            let part = line.split(',');
            for (let i = 0; i <= 1; i++) {
                petitionNum++;
                cities[part[i]] = { id : part[i] };
                cities[part[i]].lat =  part[2 + i*2];
                cities[part[i]].lon =  part[3 + i*2];
                cities[part[i]].petitionNum =  petitionNum;
            }
            callback(cities);
            delete cities[part[0]];
            delete cities[part[1]];
        }
    });
}

function waitUntilKeyAvailable(callback){
    if (actualNoOfKeys <= 0){
        let intvar =  setInterval(() => {
            if (actualNoOfKeys > 0) {
                callback();
                clearInterval(intvar);
            }
        }, 500);
    } else {
      actualNoOfKeys--;
      callback()
    }
}

//Checa el clima en la api de open weather asincronamente
function getWeatherOnce(city, callback) {
    const appid = '369594dfbf7562aa7eae28d55e9ad170';
    let originPath = '/data/2.5/weather?&units=metric';
    const options = {
        hostname : 'api.openweathermap.org',
        path : originPath+= '&appid=' + appid +'&lat=' + city.lat + '&lon=' + city.lon,
    }

    waitUntilKeyAvailable(() => {
        http.get(options, (res) => {
            let rawData = '';
            res.on('data', (data) => {
                rawData += data;
            });
            res.on('end', () => {
                parsedData = JSON.parse(rawData);
                // console.log(res.statusCode);
                // console.log(parsedData);
                city.temp = parsedData.main.temp + '°C';
                city.country = parsedData.sys.country;
                city.cityName = parsedData.name;
                totalPetits++;
                callback(city);
            });
        }).on("error", (err) => {
            console.error("Error malo: " + err.message);
        });
    });
}

/*Busca una ciudad en el cache, si no esta, la mete al cache, si por el otro lado
 esta no esta, la mete al cache, regresa en un callback a la ciudad en el cache.
*/
function getIntoCache(city, callback) {
    let id = city['id'];

    if (cityCache[id] == undefined) { //Si no esta en el cache
        cityCache[id] = city;
        getWeatherOnce(city, (city) => {
            cityCache[id] = city; //Lo metemos al cache
            callback(city);
        });
    } else { //Si si esta en el cache
        setTimeout(() => {
            callback(cityCache[id]);
        }, 500)
    }
}

function checkCache(cities, callback) {
    let asinCheck = 0;
    let orig = Object.keys(cities)[0];
    let dest = Object.keys(cities)[1];

    for (let id in cities) {
        asinCheck++;
        getIntoCache(cities[id], (city) => { asinCheck--; });
    }

    let inter = setInterval(() => {
        if (asinCheck == 0) {
            let regresa = [cityCache[orig], cityCache[dest]];
            callback(regresa);
            clearInterval(inter);
        }
    }, 500);
}

function printDaCities(cities) {
    let str = '';
    let toggle = 0;

    for (let id in cities) {
        if (toggle == 0) {
            str += 'ORIGIN \n';
            toggle = 1;
        } else
            str += 'DESTINY \n';
        str += 'ID: ' + cities[id].id + '\t';
        str += 'COUNTRY: ' + cities[id].country + '\t';
        str += 'NAME: ' + cities[id].cityName + '\n';
        str += 'LAT: ' + cities[id].lat + '\t';
        str += 'LON: ' + cities[id].lon + '\t';
        str += 'TEMP: ' + cities[id].temp + '\n';
    }

    console.log('totalPetits: ', totalPetits);
    console.log('actualNoOfKeys: ', actualNoOfKeys);
    console.log(str);
}

function refreshCacheData() {
    for (let id in cityCache) {
        getWeatherOnce(cityCache[id], (city) => {
            cityCache[id] = city;
        });
    }
}

//To regfresh the cache
setInterval(() => {
    refreshCacheData();
}, dataRefreshRate);

//To regfresh the available keys every minute
setInterval(() => {
    actualNoOfKeys = defaultNoOfKeys;
}, 60000);

//This is basically the main asincronus function
readCSVFileByLine('dataset.csv', (cities) => {
    checkCache(cities, (fulledCities) => {
        printDaCities(fulledCities);
        setInterval(() => {
            printDaCities(fulledCities);
        }, 60000);
    });
});

console.log("This should apear at the begining");
