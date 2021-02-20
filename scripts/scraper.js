const https = require('https');
const fs = require('fs');
const csv=require('csvtojson')
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
const bagMetaLocation = "https://www.covid19.admin.ch/api/data/context";

var appendToFiles = false;

const cantons0 = ["CHFL","GE","VD","VS","FR","NE","JU","BE","SO","BS", "BL","AG","ZH"];
const cantons1 = ["SH", "TG", "AR", "AI", "SG", "GL", "SZ", "ZG", "LU", "NW", "OW", "UR", "GR", "TI", "FL"];

var pdfText = require('pdf-text');

var data = {};
var date;
var line;
var counter = 0;
var cantonToUse = cantons0;

downloadJSON(bagMetaLocation);
//parsePDF("../pdfarchive/2021-01-24.pdf");

  function downloadJSON(source) {
  var metaJson;
  var data="";
  https.get(source,(res) => {
      let body = "";

      res.on("data", (chunk) => {
          body += chunk;
      });

      res.on("end", () => {
          try {
              let metaFile = JSON.parse(body);
              var metaDate = metaFile.sourceDate;
              var dataVersion = metaFile.dataVersion;
              var deliveredSource = metaFile.sources.individual.csv.vaccDosesDelivered;
              var administeredSource = metaFile.sources.individual.csv.vaccDosesAdministered;
              var fullyVaccSource = metaFile.sources.individual.csv.fullyVaccPersons;
              downloadFiles(deliveredSource, administeredSource, fullyVaccSource);
          } catch (error) {
              console.error(error.message);
          };
      });

  }).on("error", (error) => {
      console.error(error.message);
  });
}

function downloadFiles(deliveredSource, administeredSource, fullyVaccSource) {
  console.log("Downloading: "+deliveredSource);
  const file = fs.createWriteStream("delivered.csv");
  const request = https.get(deliveredSource, function(response) {
      response.pipe(file);

      file.on('finish', function() {
        console.log("Finished downloading delivered");
        downloadAdministered(administeredSource, fullyVaccSource);
      });
  });
}

function downloadAdministered(administeredSource, fullyVaccSource) {
  console.log("Downloading: "+administeredSource);
  const file = fs.createWriteStream("administered.csv");
  const request = https.get(administeredSource, function(response) {
      response.pipe(file);

      file.on('finish', function() {
        console.log("Finished downloading administered");
        downloadFullyVacc(fullyVaccSource)
      });
  });
}

function downloadFullyVacc(fullyVaccSource) {
  console.log("Downloading: "+fullyVaccSource);
  const file = fs.createWriteStream("fullyVac.csv");
  const request = https.get(fullyVaccSource, function(response) {
      response.pipe(file);

      file.on('finish', function() {
        console.log("Finished downloading fully vacc");
        parseData();
      });
  });
}

var data = {};
var date;

async function parseData() {
  let administered=await csv().fromFile("administered.csv");
  let delivered=await csv().fromFile("delivered.csv");
  let fullyVacc=await csv().fromFile("fullyVac.csv");
  date = "2021-02-14"; //administered[administered.length-1].date;
  delivered = delivered.filter(d => (d.type == "COVID19VaccDosesDelivered" && d.date==date));
  administered = administered.filter(d => (d.date==date));
  fullyVacc = fullyVacc.filter(d => (d.date==date && d.granularity=="summary"));
  console.log("Date: "+date);
  delivered.forEach((item, i) => {
    let canton = item.geoRegion;
    if(canton && canton!="") {
      if(!data[canton]) {
         data[canton] = {};
       }
       data[canton].delivered = parseInt(item.sumTotal);
     }
   });
   administered.forEach((item, i) => {
     let canton = item.geoRegion;
     if(canton && canton!="") {
       if(!data[canton]) {
          data[canton] = {};
        }
        data[canton].injected = parseInt(item.sumTotal);
        data[canton].percentage = parseFloat(item.per100PersonsTotal);
      }
    });
    fullyVacc.forEach((item, i) => {
      let canton = item.geoRegion;
      if(canton && canton!="") {
        if(!data[canton]) {
           data[canton] = {};
         }
         data[canton].fullyVacc = parseInt(item.sumTotal);
         data[canton].fullyVaccPercentage = parseFloat(item.per100PersonsTotal);
       }
     });
    checkPlausability();
}

function checkPlausability() {
  var sumdelivered = 0;
  var suminjected = 0;
  var sumfullyvacc = 0;
  for (var canton in data) {
    if(canton!="CHFL" && canton!="CH") {
      sumdelivered += data[canton].delivered;
      suminjected += data[canton].injected;
      sumfullyvacc += data[canton].fullyVacc;
    }
  }
  console.log("Sum delivered: "+sumdelivered);
  console.log("CHFL delivered: "+data.CHFL.delivered);
  console.log("Sum injected: "+suminjected);
  console.log("CHFL delivered: "+data.CHFL.injected);
  console.log("Sum fullyVac: "+sumfullyvacc);
  console.log("CHFL fullyVac: "+data.CHFL.fullyVacc);
  let plausibilitySumDelivered = sumdelivered==data.CHFL.delivered;
  let plausabilitySumInjected = suminjected==data.CHFL.injected;
  let plausabilityFullyVacc = sumfullyvacc==data.CHFL.fullyVacc;
  if(plausibilitySumDelivered) console.log('\x1b[42m%s\x1b[0m', "Plausability Sum Delivered: CHECK");
  else console.log('\x1b[41m%s\x1b[0m', "CAUTION: Plausability Sum Delivered: FAILED");
  if(plausabilitySumInjected) console.log('\x1b[42m%s\x1b[0m', "Plausability Sum Injected: CHECK");
  else console.log('\x1b[41m%s\x1b[0m', "CAUTION: Plausability Sum Injected: FAILED");
  if(plausabilityFullyVacc) console.log('\x1b[42m%s\x1b[0m', "Plausability Sum FullyVacc: CHECK");
  else console.log('\x1b[41m%s\x1b[0m', "CAUTION: Plausability Sum FullyVacc: FAILED");

  if(plausabilitySumInjected && plausibilitySumDelivered && plausabilityFullyVacc) {
    console.log('\x1b[42m%s\x1b[0m', "EVERYTHING PLAUSIBLE");
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
      csv += data[canton].percentage+",";
      csv += data[canton].fullyVacc+",";
      csv += data[canton].fullyVaccPercentage;
      csv += "\n";
  }
  console.log(csv);
  return;
  let oldPath = 'administered.csv'
  let newPath = '../archive/'+date+'_'+oldPath;
  fs.rename(oldPath, newPath, function (err) {
    if (err) throw err
    console.log('\x1b[42m%s\x1b[0m', 'Successfully renamed '+oldPath+' - AKA moved!')
  });
  oldPath = 'delivered.csv'
  newPath = '../archive/'+date+'_'+oldPath;
  fs.rename(oldPath, newPath, function (err) {
    if (err) throw err
    console.log('\x1b[42m%s\x1b[0m', 'Successfully renamed '+oldPath+' - AKA moved!')
  });
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