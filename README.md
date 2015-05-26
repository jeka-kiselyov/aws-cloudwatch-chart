# aws-cloudwatch-chart

A node.js module to draw charts for AWS CloudWatch metrics

Example chart:
![Example of CloudWatch chart generated with aws-cloudwatch-chart node.js module](http://jeka-kiselyov.github.io/aws-cloudwatch-chart/example.png)

Installation:
```bash
npm install aws-cloudwatch-chart
```

Usage:

```javascript
	var AwsCloudWatchChart = require('aws-cloudwatch-chart');
	var config = require('./config.json');
	var acs = new AwsCloudWatchChart(config);

	acs.getChart().then(function(chart){
		chart.save('image.png').then(function(filename){
			//// filename should be == 'image.png' this is your chart.
		}
	});
```

or

```javascript
	acs.getChart().then(function(chart){
		chart.get().then(function(image){
			//// image is png image.
		}
	});
```

config.json example:

```javascript
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
```

AWS Lambda ready:
-------

Sample AWS Lambda function: post CloudWatch alert chart for EC2 CPU utilization to Slack channel:

```javascript
   
////// Upload it to Lambda as zip archive. With node_modules directory. After:
////// npm install aws-cloudwatch-chart
////// npm install request

exports.handler = function(event, context) {


	var request = require('request');
	var fs = require('fs');
    var AwsCloudWatchChart = require('aws-cloudwatch-chart');

    var config = {};
	config.slack = {
		token: 'xoxp-234234234-234234234-234234234-234234234', 			/// Slack API token
		channel: 'C323MTX9Z',											//// Slack channel to post file to
		initialComment: "EC2 CPU Usage %from_time% to %to_time% UTC",	//// Initial comment format
		fileTitle: "EC2 CPU Usage %from_time% to %to_time% UTC"			//// File title format
	};
	config.aws = {
	    accessKeyId: "XXXXXXXXXXXX",							/// Dpn't forget to allow IAM to access CloudWatch. Not other policies are required. Safe.
	    secretAccessKey: "xxxxxxx/xxxxxxxxxx/xxxxxxxxxxxx",
	    region: "us-east-1"
	};

	config.timeOffset = 1440;
	config.timePeriod = 60;
	config.graphSamples = 20;
	config.width = 1000;
	config.height = 250;

	if (typeof(event.Records) === 'undefined' || typeof(event.Records[0]) === 'undefined' || typeof(event.Records[0].Sns) === 'undefined')
		context.fail ('ERROR: requires SNS message');

	if (typeof(event.Records[0].Sns.Message) !== 'undefined' && typeof(event.Records[0].Sns.Message.Trigger) === 'undefined')
		event.Records[0].Sns.Message = JSON.parse(event.Records[0].Sns.Message);

	config.slack.initialComment = event.Records[0].Sns.Subject + "\n" + event.Records[0].Sns.Message.AlarmDescription;

	config.metrics = [];

	console.log('event.Records[0].Sns.Message:');
	console.log(event.Records[0].Sns.Message);


	if (typeof(event.Records[0].Sns.Message.Trigger) !== 'undefined' && typeof(event.Records[0].Sns.Message.Trigger.Dimensions) !== 'undefined')
	if (event.Records[0].Sns.Message.Trigger.Namespace == 'AWS/EC2' && event.Records[0].Sns.Message.Trigger.MetricName == 'CPUUtilization')
	{
		config.metrics.push({
	      InstanceId: event.Records[0].Sns.Message.Trigger.Dimensions[0].value,
	      title: event.Records[0].Sns.Message.Trigger.Dimensions[0].value+" Max CPU Usage",
	      Namespace: event.Records[0].Sns.Message.Trigger.Namespace,
	      MetricName: event.Records[0].Sns.Message.Trigger.MetricName,
	      StatisticValues: "Maximum",
	      Unit: "Percent",
	      color: "af9cf4",
	      thickness: 2,
	      dashed: false
		});
	}

	if (config.metrics.length < 1)
		context.fail ('ERROR: requires SNS alarm of AWS/EC2 CPUUtilization metric');		

    var acs = new AwsCloudWatchChart(config);

	console.log('Start');

    acs.getChart().then(function(chart){

    	console.log('Got chart URL');
    	console.log(chart.getURL());

        chart.get().then(function(image){

	    	console.log('Got chart image');

			var fileTitle = config.slack.fileTitle.
							split('%from_time%').join(acs.getFromTimeString()).
							split('%to_time%').join(acs.getToTimeString());
			var initialComment = 	config.slack.initialComment.
									split('%from_time%').join(acs.getFromTimeString()).
									split('%to_time%').join(acs.getToTimeString());

			var apiURL = "https://slack.com/api/files.upload?token=" + encodeURIComponent(config.slack.token) + 
							"&filename=" + encodeURIComponent("image.png") + 
							"&title=" + encodeURIComponent(fileTitle) + 
							"&initial_comment=" + encodeURIComponent(initialComment) + 
							"&channels=" + encodeURIComponent(config.slack.channel);


	    	console.log('Sending file to Slack...');
	    	var callback = function (err, response, body) {
			    	console.log('Done. Response:');
					console.log(body);
					context.done(null);
			}

			var req = request.post(apiURL, callback);
			var form = req.form();
			form.append('file', new Buffer(image), {contentType: 'image/png', filename: 'x.png', name: 'x.png'});
        });
    });


};
```


Source
-------
[On GitHub](https://github.com/jeka-kiselyov/aws-cloudwatch-chart)

License
-------
MIT
