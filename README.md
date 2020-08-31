# Requirements Needed

The main goal of this project is to provide an easy and non-intrusive way to run serverless locally.
But for us to accomplish this we need more requirements from different projects using serverless.
If you feel inclined please create a new issue if your project needs.

## About The Project

Run your lambda functions locally as express endpoints.
In this version we support AWS lambda definitions as well with COGNITO authorizer.


## Getting Started

To get a local copy up and running follow these simple steps.


### Installation

```sh
npm install -D lambda-to-express
```


## Usage

Inside package.json create a new entry on scripts
```sh
lambda-to-express serverless.yaml
```
This will instantiate a new express server with the http routes defined in your serverless yaml.
This project will load and make available all variables inside your .env to the functions.

To use COGNITO authorizer you need to create a json file called .lterc in the root of your project with the following format:

You can as well execute a preRunner to register any file compiler like handlebars.

```json
{
    "AWS_REGION": "...",      // necessary for Cognito authorizer
    "COGNITO_POOL_ID": "...", // necessary for Cognito authorizer
    "PRE_RUNNER": "..."       // path to js file to be executed before routes
}
```

