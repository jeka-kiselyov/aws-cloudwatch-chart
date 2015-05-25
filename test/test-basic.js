var should = require('chai').should();
var AwsCloudWatchChart = require('../aws-cloudwatch-chart');


describe('AwsCloudWatchChart', function() {
  it('is function', function() {
    (typeof(AwsCloudWatchChart)).should.equal('function');
  });
});