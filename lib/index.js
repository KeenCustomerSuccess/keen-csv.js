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

    // This is most likely to happen if the user sets the 'delimiter' to '.'
    // without changing the delimiterSub.
    if (this.options.delimiter == this.options.delimiterSub) {
      throw new Error(`options.delimiter cannot be the same as options.delimiterSub! Try changing one of them.`);
    }
  }


  /**
   * columnIsFiltered - Determines whether a column should be filtered out
   *
   * @param  {String} column  The column header
   * @return {Boolean}        True: Filter out this colum, False: Do not.
   */
  columnIsFiltered(column) {
    return Array.isArray(this.options.filteredColumns) &&
           this.options.filteredColumns.length > 0 &&
           this.options.filteredColumns.length.includes(header)
  }


  /**
   * generateResultColumns - Transforms the Keen result columnar Map, keyed by
   *  header
   *
   * @return {Map}  A map of Keen results in the form:
   *  {
   *    headerName: [...rowValue]
   *  }
   */
  generateResultColumns() {
    let _resultsColumns = new Map;
    _resultsColumns.maxRowIndex = 0; // We're going to count the rows, for future use

    // Exit early if this is a simple math operation
    if (!isNaN(this.result)) {
      _resultsColumns.set('result', [this.result]);
      _resultsColumns.maxRowIndex = 1;
      return _resultsColumns;
    }

    // Adds a value into the results column
    let setColumnValue = (header, row, value) => {
      // Let's return early if this header is supposed to be filtered out.
      if (!this.columnIsFiltered(header)) {
        return;
      }

      // Now retrieve the column, instantiating it if necessary
      let column;
      if (!_resultsColumns.has(header)) {
        column = []
        _resultsColumns.set(header, column);
      } else {
        column = _resultsColumns.get(header);
      }

      column[row] = value; // set the value

      // Keep track of how many rows we're working with.
      _resultsColumns.maxRowIndex = Math.max(row, _resultsColumns.maxRowIndex);
    }

    // Converts any nested dictionaries into a flattened/delimited one.
    let flatten = (object, flattened = {}, prefix = "") => {
      for (let key in object) {
        if (null === object[key] ||
            ['string', 'number', 'boolean', 'undefined'].includes(typeof(object[key]))
        ) {
          flattened[prefix + key] = object[key];
        } else {
          // Recurse!
          flatten(object[key], flattened, prefix + key + this.options.nestedDelimiter);
        }
      }
      return flattened;
    }

    let rowIndex = 0;
    this.result.forEach((object) => {
      if (Array.isArray(object.value)) {
        // This result is grouped! We're gonna have to create alot more columns and rows.
        object.value.forEach(group => {
          // iterate over each value grouping, and store the values
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


  /**
   * generateCSV - Generates and returns a CSV for this Keen response
   *
   * @return {String}  The CSV you're looking for
   */
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


/**
 * KeenToCSV.convert - Convenience function. Allows for inline csv generation,
 * or as a link in a Promise chain:
 *    keenAnalysis
 *      .query(blah)
 *      .then(KeenToCSV.convert)
 *      .then(blah)
 *
 * @param  {Object} response The Keen response, directly from KeenAnalysis
 * @param  {Object} options  An options hash. Avaliable options are:
 *  delimiter:        Use this to use a non-comma character as a delimiter
 *  delimiterSub:     `delimiter` characters in the result are converted to this
 *  nestedDelimiter:  Nested hash keys are flattened with this
 *  filteredColumns:  An array of strings to disinclude from the csv
 * @return {String}   The CSV you're looking for
 */
KeenToCSV.convert = function(response, options) {
  console.log('starting.');
  let keenToCSV = new KeenToCSV(response, options);
  return keenToCSV.generateCSV();
}


/**
 * KeenToCSV.convertWithOptions - Convenience function specifically for
 * promises. Allows for configuring KeenToCSV as a link in a promise chain:
 *    keenAnalysis
 *      .query(blah)
 *      .then(KeenToCSV.convertWithOptions({
 *        delimiter:        '&',
 *        filteredColumns:  ['timestamp.start', 'timestamp.end']
 *      }))
 *      .then(blah)
 *
 * @param  {Object} options  An options hash. Avaliable options are:
 *  delimiter:          Use this to use a non-comma character as a delimiter
 *  delimiterSub:       `delimiter` characters in the result are converted to this
 *  nestedDelimiter:    Nested hash keys are flattened with this
 *  filteredColumns:    An array of strings to disinclude from the csv
 * @return {Function}   A wrapper around KeenToCSV.convert
 */
KeenToCSV.convertWithOptions = function(options) {
  return function(response) {
    return KeenToCSV.convert(response, options);
  }
}

module.exports = KeenToCSV
