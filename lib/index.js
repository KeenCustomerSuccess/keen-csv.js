let defaultOptions = {
  delimiter:        ',',
  delimiterSub:     '.',
  nestedDelimiter:  '.',
  filteredColumns:  null,
}

class KeenToCSV {
  constructor(response, options) {
    // First, remove the (optional) wrapping response object
    let result = response;
    if (response.hasOwnProperty('result')) {
      result = response['result'];
    }
    this.result = result;

    // Assign options
    this.options = {};
    Object.assign(this.options, defaultOptions, options);

    if (this.options.delimiter == this.options.delimiterSub) {
      throw new Error(`options.delimiter cannot be the same as options.delimiterSub! Try changing one of them.`);
    }
  }

  columnIsFiltered(column) {
    return Array.isArray(this.options.filteredColumns) &&
           this.options.filteredColumns.length > 0 &&
           this.options.filteredColumns.length.includes(header)
  }

  generateResultColumns() {
    let _resultsColumns = new Map;
    _resultsColumns.maxRowIndex = 0;

    let setColumnValue = (header, row, value) => {
      if (!this.columnIsFiltered(header)) {
        let column;
        if (!_resultsColumns.has(header)) {
          column = []
          _resultsColumns.set(header, column);
        } else {
          column = _resultsColumns.get(header);
        }
        if (column[row]) {
          console.warn(`header value ${header} in row ${row} already exists!`);
        }
        column[row] = value;
      }
      _resultsColumns.maxRowIndex = Math.max(row, _resultsColumns.maxRowIndex);
    }

    let flatten = (object, flattened = {}, prefix = "") => {
      for (let key in object) {
        if (null === object[key] ||
            ['string', 'number', 'boolean', 'undefined'].includes(typeof(object[key]))
        ) {
          flattened[prefix + key] = object[key];
        } else {
          flatten(object[key], flattened, prefix + key + this.options.nestedDelimiter);
        }
      }
      return flattened;
    }

    // Exit early if this is a simple math operation
    if (!isNaN(this.result)) {
      _resultsColumns.set('result', [this.result])
      return _resultsColumns;
    }

    let rowIndex = 0;
    this.result.forEach((object) => {
      if (Array.isArray(object.value)) {
        // This result is grouped! We're gonna have to create alot more columns and rows.
        object.value.forEach(group => {
          let flattenedGroup = flatten(group)
          for (let key in flattenedGroup) {
            setColumnValue(key, rowIndex, flattenedGroup[key]);
          }
          if (object.timeframe) {
            let flattenedTimeframe = flatten({timeframe: object.timeframe})
            for (let key in flattenedTimeframe) {
              setColumnValue(key, rowIndex, flattenedTimeframe[key]);
            }
          }
          rowIndex += 1;
        });
      } else {
        // Not grouped: This either an Extraction or a math operation on an interval.
        let flattened = flatten(object)
        for (let key in flattened) {
          setColumnValue(key, rowIndex, flattened[key]);
        }
        rowIndex += 1;
      }
    });

    return _resultsColumns;
  }

  generateCSV() {
    let resultColumns = this.generateResultColumns();
    let valueRegex = new RegExp(this.options.delimiter.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), 'g');
    let filterValue = (value) => {
      if (value === null || value === undefined) {
        return '';
      } else {
        return String(value).replace(valueRegex, this.options.delimiterSub);
      }
    }

    let headers = Array.from(resultColumns.keys());
    let csv = headers.map(filterValue).join(this.options.delimiter);
    let rowIndex = 0;
    while (rowIndex <= resultColumns.maxRowIndex) {
      csv += "\n"
      csv += headers.map((header) => {
        return filterValue(resultColumns.get(header)[rowIndex]);
      }).join(this.options.delimiter);
      rowIndex += 1;
    }

    return csv;
  }
}

KeenToCSV.convert = (response, options) => {
  console.log('starting.');
  let keenToCSV = new KeenToCSV(response, options);
  return keenToCSV.generateCSV();
}

KeenToCSV.convertWithOptions = function(options) {
  return function(response) {
    return KeenToCSV.convert(response, options);
  }
}

module.exports = KeenToCSV
