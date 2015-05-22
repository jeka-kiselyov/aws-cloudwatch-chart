# aws-cloudwatch-graph

A node.js module to draw graphs for AWS CloudWatch metrics

Usage:

```javascript
	var AwsCloudWatchGraph = require('aws-cloudwatch-graph');
	var config = require('./config.json');
	var acs = new AwsCloudWatchGraph(config);

	acs.getGraph().then(function(graph){
		graph.save('image.png').then(function(filename){
			//// filename should be == 'image.png' this is your graph.
		}
	});
```

or

```javascript
	acs.getGraph().then(function(graph){
		graph.get().then(function(image){
			//// image is png image.
		}
	});
```

config.json example:

```javascript
	{
		"metrics": [	/// array of metrics settings
			{
                /// Title of metrics. Will be displayed on graph's legend. Should be unique
				"title": "Peku1 Max",
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
                /// Graph line color for this metric
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
		"graphSamples": 20 		//// Data points extrapolated on graph
	}
```


License
-------
MIT
