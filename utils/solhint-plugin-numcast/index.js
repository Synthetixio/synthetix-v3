class NumericCastChecker {
  constructor(reporter, config, inputSrc, fileName) {
    console.log('> Constructor');
    this.ruleId = 'numcast';

    this.reporter = reporter;
    this.config = config;
    this.inputSrc = inputSrc;
    this.fileName = fileName;
  }

  enterSourceUnit() {
    this.SourceUnit();
  }

  SourceUnit() {
    console.log('SourceUnit');
  }

  errorAt(line, column, message) {
    this.reporter.errorAt(line, column, this.ruleId, message);
  }
}

module.exports = [NumericCastChecker];
