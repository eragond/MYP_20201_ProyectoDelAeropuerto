const Aero = require('../src/WeatherApp');

function testReadCSVFileByLine() {
    Aero.readCSVFileByLine('test/testdataset.csv', (line) => {
        if (/([A-Z]{3},){2}(-?\d+\.?\d+,?){3}-?\d+\.?\d+/.test(line))
            console.log('File reader test successful :) ');
        else
            console.log('File reader test failed :/ )');
    });
}

function testParseRawCities(){
    let cityLine = 'TLC,MTY,19.3371,-99.566,25.7785,-100.107';
    let cityTest = { TLC : { 'id': 'TLC', 'lat': '19.3371', 'lon': '-99.566' },
                     MTY: { 'id': 'MTY', 'lat': '25.7785', 'lon': '-100.107' } };
    Aero.parseRawCities(cityLine, (returedCity) => {
        if(JSON.stringify(returedCity) === JSON.stringify(cityTest)){
            console.log('Parser test successful :) ');
        } else {
            console.log('Parser test failed :/ )');

        }
    });

}

testReadCSVFileByLine();
testParseRawCities();
