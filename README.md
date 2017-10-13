# keen-csv.js

Takes a Keen response from [keen-analysis.js](https://github.com/keen/keen-analysis.js) and converts it to a multiline CSV string.

### Installation

Install this package from npm:

```bash
$ npm install keen-csv --save
```

Or add it directly to your `package.json`

```json
{
  "dependencies": {
    "keen-csv": "^1.0.0",
  }
}
```

### Usage

Perform a Keen query like normal, then you can run the response directly through this library in a couple of ways:

#### By direct instantiation
```javascript
import Keen from 'keen-analysis';
var KeenCSV = require('keen-csv');

const client = new Keen({
  projectId: 'YOUR_PROJECT_ID',
  readKey: 'YOUR_READ_KEY'
});

client
  .query('count', {
    event_collection: 'pageviews',
    timeframe: 'this_14_days',
    interval: 'daily',
    group_by: 'page_info.path'
  })
  .then(res => {
    let keenToCSV = new KeenCSV(res, {
      delimiter: '&'
    });
    let csvResults = keenToCSV.generateCSV();

    // Handle CSV results
  })
  .catch(err => {
    // Handle errors
  });
```

#### As a link in a Promise chain:
```javascript
import Keen from 'keen-analysis';
var KeenCSV = require('keen-csv');

const client = new Keen({
  projectId: 'YOUR_PROJECT_ID',
  readKey: 'YOUR_READ_KEY'
});

client
  .query('count', {
    event_collection: 'pageviews',
    timeframe: 'this_14_days',
    interval: 'daily',
    group_by: 'page_info.path'
  })
  .then(KeenCSV.convert)
  .then(res => {
    // Handle CSV results
  })
  .catch(err => {
    // Handle errors
  });
```

#### Or, if you'd like to include options in the Promise Chain method:
```javascript
import Keen from 'keen-analysis';
var KeenCSV = require('keen-csv');

const client = new Keen({
  projectId: 'YOUR_PROJECT_ID',
  readKey: 'YOUR_READ_KEY'
});

client
  .query('count', {
    event_collection: 'pageviews',
    timeframe: 'this_14_days',
    interval: 'daily',
    group_by: 'page_info.path'
  })
  .then(KeenCSV.convertWithOptions({
    delimiter: '&'
  }))
  .then(res => {
    // Handle CSV results
  })
  .catch(err => {
    // Handle errors
  });
```

### Options
*  `delimiter`:        Use this character rather than a comma
*  `delimiterSub`:     If we encounter any `delimiter` characters, we'll substitute them for this
*  `nestedDelimiter`:  The nature of a Keen response sometimes entails nested objects. In these cases we'll flatten the keys using this character/string
*  `filteredColumns`:  An array of column headers to filter out of the final CSV results
