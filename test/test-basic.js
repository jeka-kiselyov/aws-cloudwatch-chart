var should = require('chai').should();
var AwsCloudWatchGraph = require('../aws-cloudwatch-graph');


describe('AwsCloudWatchGraph', function() {
  it('is function', function() {
    (typeof(AwsCloudWatchGraph)).should.equal('function');
  });
});