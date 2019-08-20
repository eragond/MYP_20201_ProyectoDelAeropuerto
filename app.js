const fs = require('fs');
const readline = require('readline');
const http = require('http');

//Global variables
const dataRefreshRate = 10 * 60000 ;  // z = minutes (z * 60000 ms)
const defaultNoOfKeys = 59;           //The maximum number of requests per minute.
let actualNoOfKeys = defaultNoOfKeys; //The counter of available keys.
let cityCache = {};                   //The cache of cities.
let totalRequests = 0;                //The total number of requests.

//FUNCTION DECLARATION

/**
 * Reads a file, line by line, and callbacks by line.
 *
 * @async
 * @function readCSVFileByLine
 * @param {string} fileName The file to be read.
 * @param {function(string)} callback The line just read in the file.
 */
function readCSVFileByLine(fileName, callback) {
    const rl = readline.createInterface({ input: fs.createReadStream(fileName) });

    rl.on('line', function(line) {
        callback(line);
    });
}

/**
* Parses a string into an array of two city objects.
*
* @async
* @function parseRawCities
* @param {string} line The line to be read.
* @param {function(array[city])} callback An array associative of two cities
*                                         just parsed from the line.
*/
function parseRawCities(line, callback) {
    let cities = [];
    //Regex to verify if the string can be parsed into a city.
    if (/([A-Z]{3},){2}(-?\d+\.?\d+,?){3}-?\d+\.?\d+/.test(line)) {
        let part = line.split(',');
        for (let i = 0; i <= 1; i++) {
            cities[part[i]] = { id : part[i] };
            cities[part[i]].lat =  part[2 + i*2];
            cities[part[i]].lon =  part[3 + i*2];
        }
        callback(cities);
        delete cities[part[0]];
        delete cities[part[1]];
    }
}

/**
* Waits until an API key is available.
*
* @async
* @function waitUntilKeyIsAvailable
* @param {function()} callback Nothing, when a key is available.
*/
function waitUntilKeyIsAvailable(callback){
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

/**
* Gets the weather from the openweather API.
*
* @async
* @function getWeatherOnce
* @param {city} city A city from which we will consult its properties.
* @param {function(city)} callback A city with its properties consulted.
*/
function getWeatherOnce(city, callback) {
    const appid = '369594dfbf7562aa7eae28d55e9ad170';
    let originPath = '/data/2.5/weather?&units=metric';
    const options = {
        hostname : 'api.openweathermap.org',
        path : originPath+= '&appid=' + appid +'&lat=' + city.lat + '&lon=' + city.lon,
    }

    waitUntilKeyIsAvailable(() => {
        http.get(options, (res) => {
            let rawData = '';
            res.on('data', (data) => {
                rawData += data;
            });
            res.on('end', () => {
                parsedData = JSON.parse(rawData);
                city.temp = parsedData.hasOwnProperty('main') ?
                            parsedData.main.temp + '°C' : undefined;
                city.country = parsedData.hasOwnProperty('sys') ?
                               parsedData.sys.country : undefined;
                city.cityName = parsedData.hasOwnProperty('name') ?
                                parsedData.name : undefined;
                totalRequests++;
                callback(city);
            });
        }).on("error", (err) => {
            console.error('Sum bad thing happened with', city , err.message);
            console.log('Retrying to get info...');
            setTimeout(() => {
                getWeatherOnce(city, callback);
            }, 5000);
        });
    });
}

/**
* Looks for a city in the cache, if it's not there, it puts it in the cache
* after consulting the API, if it's in the cache it just returns the city.
*
* @async
* @function getIntoCache
* @param {city} city A city to which we will consult if it is in cache.
* @param {function(city)} callback The city after being updated in cache.
*/
function getIntoCache(city, callback) {
    let id = city['id'];

    if (cityCache[id] == undefined) {     //If it is not in the cache.
        cityCache[id] = city;
        getWeatherOnce(city, (city) => {
            cityCache[id] = city;         //We put it in the cache.
            callback(city);
        });
    } else {                              //If it is in the cache.
        setTimeout(() => {                //Just return it.
            callback(cityCache[id]);
        }, 500)
    }
}

/**
* Gets the properties of the two cities given by {cities}.
*
* @async
* @function checkCacheForCityPairs
* @param {array[city]} cities A couple of cities to get their information.
* @param {function(array[cities])} callback An array of the two cities updated.
*/
function checkCacheForCityPairs(cities, callback) {
    let asinCheck = 0;
    let orig = Object.keys(cities)[0];
    let dest = Object.keys(cities)[1];

    for (let id in cities) {
        asinCheck++;
        getIntoCache(cities[id], (city) => { asinCheck--; });
    }
    //Interval to wait until both cities are defined.
    let inter = setInterval(() => {
        if (asinCheck == 0) {
            let regresa = [cityCache[orig], cityCache[dest]];
            callback(regresa);
            clearInterval(inter);
        }
    }, 500);
}

/**
* Prints a couple of cities origin - destiny.
*
* @function printDaCities
* @param {array[city]} cities An array containing a pair of cities to be displayed.
*/
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
    // TODO: REMOVE extra logs.
    console.log('totalRequests: ', totalRequests);
    console.log('actualNoOfKeys: ', actualNoOfKeys);
    console.log(str);
}

/**
* Refreshes the data of the cities in cache.
*
* @function refreshCacheData
*/
function refreshCacheData() {
    for (let id in cityCache) {
        getWeatherOnce(cityCache[id], (city) => {
            cityCache[id] = city;
        });
    }
}

//ASYNCHRONOUS MAIN EXECUTION THREAD

//Interval to refresh the cache.
setInterval(() => {
    refreshCacheData();
}, dataRefreshRate);

//Interval to refresh the available keys, every minute.
setInterval(() => {
    actualNoOfKeys = defaultNoOfKeys;
}, 60000); //Every minute.

//This is basically the main asincronus function. Srry for the callback hell.
readCSVFileByLine('dataset3.csv', (line) => {
    parseRawCities(line, (cities) => {
        checkCacheForCityPairs(cities, (fulledCities) => {
            printDaCities(fulledCities);
            setInterval(() => {
                printDaCities(fulledCities);
            }, 60000);
        });
    });
});

// TODO: REMOVE THIS LASTS LINES.
//Nice line to check that everything is working asynchronously.
console.log("This should apear at the begining, now keep going");
