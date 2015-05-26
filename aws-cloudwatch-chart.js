/*

	aws-cloudwatch-chart

	A Node module to draw charts for AWS CloudWatch metrics
	https://github.com/jeka-kiselyov/aws-cloudwatch-chart

	Usage:

	var AwsCloudWatchChart = require('aws-cloudwatch-chart');
	var config = require('./config.json');
	var acs = new AwsCloudWatchChart(config);

	acs.getChart().then(function(chart){
		chart.save('image.png').then(function(filename){
			//// filename should be == 'image.png' this is your chart.
		}
	});

	or

	acs.getChart().then(function(chart){
		chart.get().then(function(image){
			//// image is png image.
		}
	});

	config.json example:

	{
		"metrics": [	/// array of metrics settings
			{
                /// Title of metrics. Will be displayed on chart's legend. Should be unique
				"title": "Server1 Max CPU",
                /// AWS namespace
				/// http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/aws-namespaces.html
				"namespace": "AWS/EC2",
                /// Metric name
				/// http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html
				"metricName": "CPUUtilization",		
                /// Statistics values. 'Maximum' and "Average" supported 
				"statisticValues": "Maximum",		
                /// Unit. http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricStatistics.html
                /// 'Percent' and 'Count' currently supported
				"unit": "Percent",					
                /// Chart line color for this metric
				"color": "af9cf4",				
                /// Line thickness in px
				"thickness": 2,					
                /// Dashed or solid
				"dashed": false,				
                /// Any property other that listed above will be added to Dimensions array. It's different for different metrics namespaces
				/// InstanceId. This parameter is for Dimensions array. Different for different metrics namespaces
				/// http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_Dimension.html  
				"InstanceId": "i-2d55aad0",			
			}
		],
		"aws": {
        	/// AWS IAM accessKeyId
            /// Dpn't forget to allow IAM to access CloudWatch. Not other policies are required. Safe.
			"accessKeyId": "XXXXXXXXXXXXXXXXXX",				
            /// AWS IAM secretAccessKey
			"secretAccessKey": "XXXXXX/XXXXXXXXX/XXXXXXXXXXX/XXXXXXXXX",	
            /// AWS region
			"region": "us-east-1"												
		},
		"timeOffset": 1440,		//// Get statistic for last 1440 minutes
		"timePeriod": 60,		//// Get statistic for each 60 seconds 
		"chartSamples": 20,		//// Data points extrapolated on chart
		"width": 1000,			//// Result image width. Maximum value for width or height is 1,000. Width x height cannot exceed 300,000.
		"height":250 			//// Result image height. Maximum value for width or height is 1,000. Width x height cannot exceed 300,000.
	}

*/

module.exports = (function() {

	var Q = require("q");
	var http = require('http');
	var request = require('request');
	var fs = require('fs');

	AwsCloudWatchChart = function(config) {

		if (typeof(config) === 'undefined')
			throw new Error('config parameter is missing'); 

		if (!config.hasOwnProperty('aws') || !config.aws.hasOwnProperty('accessKeyId') || !config.aws.hasOwnProperty('secretAccessKey') || !config.aws.hasOwnProperty('region'))
			throw new Error('config.aws.accessKeyId, config.aws.secretAccessKey, config.aws.region are required'); 

		this.AWS = require('aws-sdk');
		this.AWS.config.update({accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey});
		this.AWS.config.update({region: config.aws.region});

		this.cloudwatch = new this.AWS.CloudWatch();

		this.metrics = [];

		this.timeOffset = config.hasOwnProperty('timeOffset') ? config.timeOffset : 24 * 60;
		this.timePeriod = config.hasOwnProperty('timePeriod') ? config.timePeriod : 60;
		this.chartSamples = config.hasOwnProperty('chartSamples') ? config.chartSamples : 24;

		this.width = config.hasOwnProperty('width') ? config.width : 1000;
		this.height = config.hasOwnProperty('height') ? config.height : 250;

		if (this.width > 1000 || this.height > 1000 || this.height * this.width > 300000)
			throw new Error('Maximum value for width or height is 1,000. Width x height cannot exceed 300,000.');

		if (this.width < 1 || this.height < 1)
			throw new Error('Invalid width and height parameters'); 	

		if (this.timePeriod % 60 !== 0)
			throw new Error('config.timePeriod should be based on 60'); 			

		if (config.hasOwnProperty('metrics') || !isArray(config.metrics))
		{
			for (var k in config.metrics)
			{
				var m = this.addMetric(config.metrics[k]);
			}
		} else 
			throw new Error('config.metrics array required'); 

	}

	AwsCloudWatchChart.prototype.addMetric = function(params)
	{
		var m = new AwsCloudWatchChartMetric(this);
		if (typeof(params) != 'undefined')
		{
			for (var k in params)
			{
				var kl = k.toLowerCase();
				if (kl == 'title')
					m.title = '' + params[k];
				else if (kl == 'statisticvalues')
					m.statisticValues = params[k];
				else if (kl == 'namespace')
					m.Namespace = '' + params[k];
				else if (kl == 'metricname')
					m.MetricName = '' + params[k];
				else if (kl == 'color')
					m.color = params[k];
				else if (kl == 'unit')
					m.Unit = params[k];
				else if (kl == 'thickness')
					m.thickness = parseInt(params[k], 10);
				else if (kl == 'dashed')
					m.dashed = (params[k] ? true : false);
				else {
					m.Dimensions.push({Name: k, Value: params[k]});
				}
			}
		}

		this.metrics.push(m);
		return m;
	}

	AwsCloudWatchChart.prototype.getFromTimeString = function()
	{
		var i = new Date;
		i.setTime(i.getTime() - this.timeOffset*60*1000);
		return (i.getUTCMonth()+1)+"/"+i.getUTCDate()+" "+("0" + i.getUTCHours()).slice(-2)+':'+("0" + i.getUTCMinutes()).slice(-2);
	}

	AwsCloudWatchChart.prototype.getToTimeString = function()
	{
		var i = new Date;
		return (i.getUTCMonth()+1)+"/"+i.getUTCDate()+" "+("0" + i.getUTCHours()).slice(-2)+':'+("0" + i.getUTCMinutes()).slice(-2);		
	}


	AwsCloudWatchChart.prototype.getChart = function()
	{
		var d = Q.defer();
		var metricsPrmomises = [];
		for (var k in this.metrics)
			metricsPrmomises.push(this.metrics[k].getStatistics());

		var that = this;
		Q.all(metricsPrmomises).then(function(){
			d.resolve(that);
		});
		return d.promise;
	}

	AwsCloudWatchChart.prototype.listMetrics = function(Namespace, MetricName) 
	{
		if (typeof(Namespace) === 'undefined')
			var Namespace = 'AWS/EC2';
		if (typeof(MetricName) === 'undefined')
			var MetricName = 'CPUUtilization';

		var d = Q.defer();
		var params = { Namespace: Namespace, MetricName: MetricName};

		var that = this;
		this.cloudwatch.listMetrics(params, function(err, data) {
			if (err) {
				throw new Error('Error loading metrics list: '+err); 
			}
			else {
				d.resolve(data.Metrics);
			}
		});
		
		return d.promise;
	}

	AwsCloudWatchChart.prototype.EXTENDED_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';

	AwsCloudWatchChart.prototype.extendedEncode = function(arrVals, maxVal)
	{
		var chartData = '';
		var EXTENDED_MAP_LENGTH = this.EXTENDED_MAP.length;
		for (i = 0, len = arrVals.length; i < len; i++) 
		{
			var numericVal = new Number(arrVals[i]);
			// Scale the value to maxVal.
			var scaledVal = Math.floor(EXTENDED_MAP_LENGTH * EXTENDED_MAP_LENGTH * numericVal / maxVal);

			if(scaledVal > (EXTENDED_MAP_LENGTH * EXTENDED_MAP_LENGTH) - 1)
			{
				chartData += "..";
			} else if (scaledVal < 0)
			{
				chartData += '__';
			} else 
			{
				// Calculate first and second digits and add them to the output.
				var quotient = Math.floor(scaledVal / EXTENDED_MAP_LENGTH);
				var remainder = scaledVal - EXTENDED_MAP_LENGTH * quotient;
				chartData += this.EXTENDED_MAP.charAt(quotient) + this.EXTENDED_MAP.charAt(remainder);
			}
	  }

	  return chartData;
	}

	AwsCloudWatchChart.prototype.save = function(filename)
	{
		var d = Q.defer();
		var url = this.getURL();

		var file = fs.createWriteStream(filename);
		var request = http.get(url, function(response) {
			response.pipe(file);
			file.on('finish', function() {
				file.close(function(){
					d.resolve(filename);
				});  // close() is async, call cb after close completes.
			});
		}).on('error', function(err) {
			fs.unlink(filename);
			d.resolve(false);
		});

		return d.promise;
	}

	AwsCloudWatchChart.prototype.get = function()
	{
		var d = Q.defer();
		var url = this.getURL();

		var requestSettings = {
           method: 'GET',
           url: url,
           encoding: null
        };

		request(requestSettings, function (error, response, body) {
			if (!error && response.statusCode == 200) 
			{
				d.resolve(body);
			}
		});

		return d.promise;
	}

	AwsCloudWatchChart.prototype.getURL = function()
	{
		var toTime = false;
		var fromTime = false;
		var absMaxValue = 0;

		for (var km in this.metrics)
			for (var ks in this.metrics[km].statistics)
			{
				var d = new Date(this.metrics[km].statistics[ks].Timestamp);
				if (toTime === false)
					toTime = d;
				if (fromTime === false)
					fromTime = d;

				if (d > toTime)
					toTime = d;
				if (d < fromTime)
					fromTime = d;
			}

		var diff = toTime - fromTime;
		diff = diff / this.chartSamples;


		var timeLabels = [];
		var prevTime = false;
		for (var i = fromTime; i <= toTime; i.setTime(i.getTime() + diff))
		{
			if (prevTime !== false)
			{
				timeLabels.push({
					text: ("0" + i.getUTCHours()).slice(-2)+':'+("0" + i.getUTCMinutes()).slice(-2),
					from: new Date(prevTime),
					to: new Date(i.getTime())
				});
			}

			prevTime = i.getTime();
		}

		var labels = [];
		for (var k in timeLabels)
			labels.push( timeLabels[k].text );

		var datasets = [];
		for (var km in this.metrics)
		{
			var dataset = [];

			for (var ktl in timeLabels)
			{
				var maxInPeriod = 0;
				var totalInPeriod = 0;
				var totalInPeriodCount = 0;
				for (var ks in this.metrics[km].statistics)
				{
					var d = new Date(this.metrics[km].statistics[ks].Timestamp);
					if (d > timeLabels[ktl].from && d<= timeLabels[ktl].to)
					{
						if (typeof(this.metrics[km].statistics[ks].Maximum) != 'undefined')
						if (maxInPeriod < this.metrics[km].statistics[ks].Maximum)
							maxInPeriod = this.metrics[km].statistics[ks].Maximum;

						if (typeof(this.metrics[km].statistics[ks].Average) != 'undefined')
						{
							totalInPeriod+=this.metrics[km].statistics[ks].Average;
							totalInPeriodCount++;
						}
					}	
				}

				var averageInPeriod = totalInPeriod;
				if (totalInPeriodCount > 0)
					averageInPeriod = totalInPeriod / totalInPeriodCount;

				var toPush = averageInPeriod;
				if (this.metrics[km].statisticValues == 'Maximum')
					toPush = maxInPeriod;

				if (toPush > absMaxValue)
					absMaxValue = toPush;

				dataset.push(toPush);
			}

			datasets.push(dataset);
		}

		var topEdge = Math.ceil(absMaxValue*1.2);

		var datasetsAsStrings = [];
		for (var k in datasets)
			datasetsAsStrings.push(this.extendedEncode(datasets[k],topEdge));

		var datasetsAsString = datasetsAsStrings.join(',');

		var titles = [];
		for (var km in this.metrics)
			titles.push(this.metrics[km].getTitle());

		var colors = [];
		for (var km in this.metrics)
			colors.push(this.metrics[km].color);

		var styles = [];
		for (var km in this.metrics) {
			if (this.metrics[km].dashed)
				styles.push(this.metrics[km].thickness+',5,5');
			else
				styles.push(this.metrics[km].thickness);
		}


		var url = 'http://chart.googleapis.com/chart?';
		// https://developers.google.com/chart/image/docs/chart_params
		url += 'cht=lc&';
		url += 'chxl=0:|'+labels.join('|')+'&';
		url += 'chxt=x,y&';
		url += 'chco='+colors.join(',')+'&';
		url += 'chls='+styles.join('|')+'&';
		url += 'chs='+this.width+'x'+this.height+'&';
		url += 'chxr=1,0,'+topEdge+',10&'
		url += 'chg=20,10,1,5&';
		url += 'chdl='+titles.join('|')+'&'
		url += 'chd=e:'+datasetsAsString;

		return url;
	}


	AwsCloudWatchChartMetric = function(AwsCloudWatchChart) {
		this.Namespace = 'AWS/EC2';
		this.MetricName = 'CPUUtilization';
		this.Dimensions = [];
		this.Unit = 'Percent'

		this.AwsCloudWatchChart = AwsCloudWatchChart;
		this.cloudwatch = AwsCloudWatchChart.cloudwatch;

		this.title = false;

		this.statistics = [];
		this.isLoaded = false;

		this.statisticValues = 'Average';
		this.color = 'FF0000';
		this.thickness = '1';
		this.dashed = false;
	}

	AwsCloudWatchChartMetric.prototype.getStatistics = function()
	{
		var d = Q.defer();

		var toTime = new Date;
		var fromTime = new Date;

		fromTime.setTime(toTime.getTime() - this.AwsCloudWatchChart.timeOffset*60*1000);

		var params = {
			EndTime: toTime,
			StartTime: fromTime,
			MetricName: this.MetricName,
			Namespace: this.Namespace,
			Period: this.AwsCloudWatchChart.timePeriod,
			Statistics: [ this.statisticValues ],
			Dimensions: this.Dimensions,
			Unit: this.Unit
		};

		var that = this;
		this.cloudwatch.getMetricStatistics(params, function(err, data) {
			if (err) 
			{
				throw new Error('Error loading statistics: '+err); 
			}
			else  
			{
				for (var k in data.Datapoints)
					that.statistics.push(data.Datapoints[k]);
				that.isLoaded = true;
				d.resolve(that.statistics);
			} 
		});

		return d.promise;
	}

	AwsCloudWatchChartMetric.prototype.getTitle = function()
	{
		if (this.title !== false)
			return this.title;
		if (typeof(this.Dimensions[0]) != 'undefined' && typeof(this.Dimensions[0]['Value']) != 'undefined')
			return this.Dimensions[0]['Value'];
	}

	
	return AwsCloudWatchChart;

})();