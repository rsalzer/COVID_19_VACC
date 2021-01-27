const https = require('https');
const fs = require('fs');
// var Twitter = require('twitter');
const readline = require("readline");
//const core = require('@actions/core');
// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });
var config;

// try {
//   config = require('./config.js'); //for local use
//   console.log("Using local credentials");
// } catch(e) {
//   console.log("Using server credentials");
//   if(process.env.CONSUMER_KEY) {
//     console.log("We got the keys...");
//     config = {
//       consumer_key: process.env.CONSUMER_KEY,
//       consumer_secret: process.env.CONSUMER_SECRET,
//       access_token_key: process.env.ACCESS_TOKEN_KEY,
//       access_token_secret: process.env.ACCESS_TOKEN_SECRET
//     };
//   }
// }

//const cantons = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH', 'FL'];
const bagPDFLocation = "https://www.bag.admin.ch/dam/bag/de/dokumente/mt/k-und-i/aktuelle-ausbrueche-pandemien/2019-nCoV/zahlen-covid-19-impfung.pdf.download.pdf/Bislang%20total%20verimpft%20(pro%20100%20Einwohner)%20(PfizerBioNTech%20&%20Moderna)%20Stand%2021.%20Januar%202021.pdf";

var appendToFiles = false;

const cantons0 = ["CHFL","GE","VD","VS","FR","NE","JU","BE","SO","BS", "BL","AG","ZH"];
const cantons1 = ["SH", "TG", "AR", "AI", "SG", "GL", "SZ", "ZG", "LU", "NW", "OW", "UR", "GR", "TI", "FL"];

var pdfText = require('pdf-text');

var data = {};
var date;
var line;
var counter = 0;
var cantonToUse = cantons0;

downloadFile(true);
//parsePDF("../pdfarchive/2021-01-24.pdf");

function downloadFile(parseFile) {
  const file = fs.createWriteStream("temp.pdf");
  const request = https.get(bagPDFLocation, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        console.log("Finish downloading");
        if(parseFile) parsePDF("temp.pdf");
      });
  });
}

function parsePDF(pathToPdf) {
  //var pathToPdf = "temp.pdf";//"../pdfarchive/2021-01-21.pdf";

  pdfText(pathToPdf, function(err, chunks) {
           chunks.forEach((cell, j) => {
             if(cell.length>0) {
               if(cell.includes(".2021")) {
                 var m = cell.match(/\d{2}([\/.-])\d{2}\1\d{4}/g);
                 var stringDate = m[0];
                 //console.log(date);
                 var dateSplit = stringDate.split(".");
                 var day = dateSplit[0];
                 var month = dateSplit[1];
                 var year = dateSplit[2];
                 date = year+"-"+month+"-"+day;
                 console.log("Date: "+date);
               }
               cell = cell.replace(/’/g, "").replace(/'/g, "").replace(/‘/g, "");
               if(cell.startsWith("Gelieferte Impfdosen")) {
                  line = "delivered";
                  counter = 0;
                  if(data.CHFL) cantonToUse = cantons1;
               }
               else if(cell.startsWith("Bislang total")) {
                 line = "injected";
                 counter = 0;
               }
               else if(cell.startsWith("Geimpfte Dosen pro 100")) {
                 line = "percentage";
                 counter = 0;
               }
               else {
                 if(line!="") {
                   if(!isNaN(cell)) {
                     var parsed = parseFloat(cell);
                     if(!data[cantonToUse[counter]]) {
                       data[cantonToUse[counter]] = {};
                     }
                     data[cantonToUse[counter]][line] = parsed;
                     counter++;
                   }
                 }
               }
             }
           });
           console.log(data);
           checkPlausability();
  });
}

function checkPlausability() {
  var sumdelivered = 0;
  var suminjected = 0;
  for (var canton in data) {
    if(canton!="CHFL") {
      sumdelivered += data[canton].delivered;
      suminjected += data[canton].injected;
    }
  }
  console.log("Sum delivered: "+sumdelivered);
  console.log("CHFL delivered: "+data.CHFL.delivered);
  console.log("Sum injected: "+suminjected);
  console.log("CHFL delivered: "+data.CHFL.injected);
  let plausibilitySumDelivered = sumdelivered==data.CHFL.delivered;
  let plausabilitySumInjected = suminjected==data.CHFL.injected;
  if(plausibilitySumDelivered) console.log("Plausability Sum Delivered: CHECK");
  else console.log("CAUTION: Plausability Sum Delivered: FAILED");
  if(plausabilitySumInjected) console.log("Plausability Sum Injected: CHECK");
  else console.log("CAUTION: Plausability Sum Injected: FAILED");

  if(plausabilitySumInjected && plausibilitySumDelivered) {
    console.log("EVERYTHING PLAUSIBLE");
    createCSV();
  }
}

function createCSV() {
  var csv = "";
  for (var canton in data) {
      //date,geounit,ncumul_delivered,ncumul_vacc,ncumul_vacc_per100pop
      var singleData = data[canton];
      csv += date+",";
      csv += canton+",";
      csv += data[canton].delivered+","
      csv += data[canton].injected+","
      if(data[canton].percentage) csv += data[canton].percentage;
      csv += "\n";
  }
  console.log(csv);
}

function tweet(message) {
    var T = new Twitter(config);
    T.post('statuses/update', {status: message},  function(error, tweet, response) {
      if(error) {
        console.log("Error while tweeting: "+error[0].message);
        //throw error;
      }
      //console.log(tweet);  // Tweet body.
      console.log("Tweet sent");  // Raw response object.
    });
}