/**
 * PLACEHOLDER FIXTURES
 * --------------------
 * Realistic but non-authoritative sample data. Shapes mirror the intended
 * Laravel API responses so swapping Api.live = true requires no UI changes.
 * State geometry comes from geoBoundaries ADM1 (see data/nigeria-states.geojson).
 */

export const STATES = {
  "Abia": {
    "code": "AB",
    "region": "South East",
    "centroid": [
      5.4529,
      7.5249
    ],
    "commodities": [
      "lead",
      "oil",
      "gas"
    ],
    "occurrences": 48,
    "prospectivity": 42,
    "risk": "low",
    "titles": 76,
    "petroleum": true,
    "coverage": 70
  },
  "Adamawa": {
    "code": "AD",
    "region": "North East",
    "centroid": [
      9.3137,
      12.4063
    ],
    "commodities": [
      "barite",
      "gypsum",
      "kaolin"
    ],
    "occurrences": 71,
    "prospectivity": 51,
    "risk": "high",
    "titles": 92,
    "petroleum": false,
    "coverage": 67
  },
  "Akwa Ibom": {
    "code": "AK",
    "region": "South South",
    "centroid": [
      4.9062,
      7.8553
    ],
    "commodities": [
      "oil",
      "gas",
      "limestone"
    ],
    "occurrences": 54,
    "prospectivity": 58,
    "risk": "medium",
    "titles": 88,
    "petroleum": true,
    "coverage": 78
  },
  "Anambra": {
    "code": "AN",
    "region": "South East",
    "centroid": [
      6.2146,
      6.932
    ],
    "commodities": [
      "lead",
      "coal",
      "gold"
    ],
    "occurrences": 52,
    "prospectivity": 44,
    "risk": "low",
    "titles": 81,
    "petroleum": true,
    "coverage": 71
  },
  "Bauchi": {
    "code": "BA",
    "region": "North East",
    "centroid": [
      10.7775,
      9.9999
    ],
    "commodities": [
      "tin",
      "gold",
      "gypsum"
    ],
    "occurrences": 118,
    "prospectivity": 66,
    "risk": "medium",
    "titles": 164,
    "petroleum": false,
    "coverage": 75
  },
  "Bayelsa": {
    "code": "BY",
    "region": "South South",
    "centroid": [
      4.7725,
      6.0695
    ],
    "commodities": [
      "oil",
      "gas"
    ],
    "occurrences": 46,
    "prospectivity": 71,
    "risk": "medium",
    "titles": 63,
    "petroleum": true,
    "coverage": 84
  },
  "Benue": {
    "code": "BE",
    "region": "North Central",
    "centroid": [
      7.336,
      8.738
    ],
    "commodities": [
      "barite",
      "lead",
      "limestone"
    ],
    "occurrences": 134,
    "prospectivity": 69,
    "risk": "medium",
    "titles": 198,
    "petroleum": false,
    "coverage": 76
  },
  "Borno": {
    "code": "BO",
    "region": "North East",
    "centroid": [
      11.8936,
      13.1605
    ],
    "commodities": [
      "kaolin",
      "gypsum",
      "iron"
    ],
    "occurrences": 62,
    "prospectivity": 38,
    "risk": "high",
    "titles": 54,
    "petroleum": false,
    "coverage": 61
  },
  "Cross River": {
    "code": "CR",
    "region": "South South",
    "centroid": [
      5.8732,
      8.602
    ],
    "commodities": [
      "barite",
      "limestone",
      "lead"
    ],
    "occurrences": 96,
    "prospectivity": 57,
    "risk": "medium",
    "titles": 142,
    "petroleum": true,
    "coverage": 77
  },
  "Delta": {
    "code": "DE",
    "region": "South South",
    "centroid": [
      5.7056,
      5.9371
    ],
    "commodities": [
      "oil",
      "gas",
      "kaolin"
    ],
    "occurrences": 68,
    "prospectivity": 74,
    "risk": "medium",
    "titles": 117,
    "petroleum": true,
    "coverage": 86
  },
  "Ebonyi": {
    "code": "EB",
    "region": "South East",
    "centroid": [
      6.265,
      8.0138
    ],
    "commodities": [
      "lead",
      "barite",
      "limestone"
    ],
    "occurrences": 142,
    "prospectivity": 73,
    "risk": "low",
    "titles": 214,
    "petroleum": false,
    "coverage": 78
  },
  "Edo": {
    "code": "ED",
    "region": "South South",
    "centroid": [
      6.6343,
      5.9307
    ],
    "commodities": [
      "gold",
      "limestone",
      "oil"
    ],
    "occurrences": 104,
    "prospectivity": 62,
    "risk": "low",
    "titles": 176,
    "petroleum": true,
    "coverage": 80
  },
  "Ekiti": {
    "code": "EK",
    "region": "South West",
    "centroid": [
      7.719,
      5.311
    ],
    "commodities": [
      "kaolin",
      "gold",
      "granite"
    ],
    "occurrences": 78,
    "prospectivity": 54,
    "risk": "low",
    "titles": 131,
    "petroleum": false,
    "coverage": 69
  },
  "Enugu": {
    "code": "EN",
    "region": "South East",
    "centroid": [
      6.5369,
      7.4357
    ],
    "commodities": [
      "coal",
      "limestone",
      "lead"
    ],
    "occurrences": 86,
    "prospectivity": 56,
    "risk": "low",
    "titles": 128,
    "petroleum": false,
    "coverage": 70
  },
  "Federal Capital Territory": {
    "code": "FC",
    "region": "North Central",
    "centroid": [
      8.8941,
      7.1862
    ],
    "commodities": [
      "tin",
      "marble",
      "clay"
    ],
    "occurrences": 34,
    "prospectivity": 41,
    "risk": "low",
    "titles": 62,
    "petroleum": false,
    "coverage": 62
  },
  "Gombe": {
    "code": "GO",
    "region": "North East",
    "centroid": [
      10.3645,
      11.1936
    ],
    "commodities": [
      "gypsum",
      "limestone",
      "kaolin"
    ],
    "occurrences": 58,
    "prospectivity": 44,
    "risk": "medium",
    "titles": 71,
    "petroleum": false,
    "coverage": 64
  },
  "Imo": {
    "code": "IM",
    "region": "South East",
    "centroid": [
      5.5709,
      7.061
    ],
    "commodities": [
      "oil",
      "gas",
      "lead"
    ],
    "occurrences": 44,
    "prospectivity": 49,
    "risk": "low",
    "titles": 69,
    "petroleum": true,
    "coverage": 73
  },
  "Jigawa": {
    "code": "JI",
    "region": "North West",
    "centroid": [
      12.2289,
      9.5611
    ],
    "commodities": [
      "kaolin",
      "iron",
      "barite"
    ],
    "occurrences": 41,
    "prospectivity": 33,
    "risk": "medium",
    "titles": 47,
    "petroleum": false,
    "coverage": 58
  },
  "Kaduna": {
    "code": "KD",
    "region": "North West",
    "centroid": [
      10.377,
      7.7086
    ],
    "commodities": [
      "gold",
      "iron",
      "kaolin"
    ],
    "occurrences": 164,
    "prospectivity": 79,
    "risk": "high",
    "titles": 241,
    "petroleum": false,
    "coverage": 81
  },
  "Kano": {
    "code": "KN",
    "region": "North West",
    "centroid": [
      11.7475,
      8.5244
    ],
    "commodities": [
      "tin",
      "gold",
      "iron"
    ],
    "occurrences": 92,
    "prospectivity": 58,
    "risk": "medium",
    "titles": 134,
    "petroleum": false,
    "coverage": 71
  },
  "Katsina": {
    "code": "KT",
    "region": "North West",
    "centroid": [
      12.3879,
      7.6376
    ],
    "commodities": [
      "gold",
      "kaolin",
      "iron"
    ],
    "occurrences": 74,
    "prospectivity": 52,
    "risk": "high",
    "titles": 96,
    "petroleum": false,
    "coverage": 68
  },
  "Kebbi": {
    "code": "KE",
    "region": "North West",
    "centroid": [
      11.7182,
      4.5112
    ],
    "commodities": [
      "gold",
      "barite",
      "kaolin"
    ],
    "occurrences": 108,
    "prospectivity": 71,
    "risk": "high",
    "titles": 118,
    "petroleum": false,
    "coverage": 77
  },
  "Kogi": {
    "code": "KO",
    "region": "North Central",
    "centroid": [
      7.736,
      6.6861
    ],
    "commodities": [
      "iron",
      "gold",
      "coal"
    ],
    "occurrences": 186,
    "prospectivity": 84,
    "risk": "medium",
    "titles": 274,
    "petroleum": false,
    "coverage": 84
  },
  "Kwara": {
    "code": "KW",
    "region": "North Central",
    "centroid": [
      8.962,
      4.3921
    ],
    "commodities": [
      "gold",
      "marble",
      "kaolin"
    ],
    "occurrences": 112,
    "prospectivity": 68,
    "risk": "low",
    "titles": 157,
    "petroleum": false,
    "coverage": 76
  },
  "Lagos": {
    "code": "LA",
    "region": "South West",
    "centroid": [
      6.5222,
      3.6015
    ],
    "commodities": [
      "barite",
      "gas"
    ],
    "occurrences": 18,
    "prospectivity": 22,
    "risk": "low",
    "titles": 34,
    "petroleum": false,
    "coverage": 53
  },
  "Nasarawa": {
    "code": "NA",
    "region": "North Central",
    "centroid": [
      8.4996,
      8.1998
    ],
    "commodities": [
      "lithium",
      "barite",
      "tin"
    ],
    "occurrences": 198,
    "prospectivity": 94,
    "risk": "medium",
    "titles": 286,
    "petroleum": false,
    "coverage": 89
  },
  "Niger": {
    "code": "NI",
    "region": "North Central",
    "centroid": [
      9.93,
      5.5999
    ],
    "commodities": [
      "gold",
      "lithium",
      "talc"
    ],
    "occurrences": 176,
    "prospectivity": 86,
    "risk": "high",
    "titles": 249,
    "petroleum": false,
    "coverage": 85
  },
  "Ogun": {
    "code": "OG",
    "region": "South West",
    "centroid": [
      6.9963,
      3.4688
    ],
    "commodities": [
      "limestone",
      "kaolin",
      "barite"
    ],
    "occurrences": 88,
    "prospectivity": 53,
    "risk": "low",
    "titles": 164,
    "petroleum": false,
    "coverage": 68
  },
  "Ondo": {
    "code": "ON",
    "region": "South West",
    "centroid": [
      6.9141,
      5.148
    ],
    "commodities": [
      "oil",
      "gold",
      "kaolin"
    ],
    "occurrences": 94,
    "prospectivity": 64,
    "risk": "low",
    "titles": 148,
    "petroleum": true,
    "coverage": 81
  },
  "Osun": {
    "code": "OS",
    "region": "South West",
    "centroid": [
      7.5627,
      4.5191
    ],
    "commodities": [
      "gold",
      "granite",
      "kaolin"
    ],
    "occurrences": 126,
    "prospectivity": 76,
    "risk": "low",
    "titles": 192,
    "petroleum": false,
    "coverage": 80
  },
  "Oyo": {
    "code": "OY",
    "region": "South West",
    "centroid": [
      8.1583,
      3.6136
    ],
    "commodities": [
      "marble",
      "kaolin",
      "gold"
    ],
    "occurrences": 118,
    "prospectivity": 67,
    "risk": "low",
    "titles": 186,
    "petroleum": false,
    "coverage": 75
  },
  "Plateau": {
    "code": "PL",
    "region": "North Central",
    "centroid": [
      9.2184,
      9.5175
    ],
    "commodities": [
      "tin",
      "lead",
      "barite"
    ],
    "occurrences": 212,
    "prospectivity": 91,
    "risk": "medium",
    "titles": 312,
    "petroleum": false,
    "coverage": 87
  },
  "Rivers": {
    "code": "RI",
    "region": "South South",
    "centroid": [
      4.8417,
      6.9106
    ],
    "commodities": [
      "oil",
      "gas"
    ],
    "occurrences": 58,
    "prospectivity": 77,
    "risk": "medium",
    "titles": 94,
    "petroleum": true,
    "coverage": 87
  },
  "Sokoto": {
    "code": "SO",
    "region": "North West",
    "centroid": [
      13.0567,
      5.3182
    ],
    "commodities": [
      "limestone",
      "kaolin",
      "gypsum"
    ],
    "occurrences": 66,
    "prospectivity": 46,
    "risk": "medium",
    "titles": 78,
    "petroleum": false,
    "coverage": 65
  },
  "Taraba": {
    "code": "TA",
    "region": "North East",
    "centroid": [
      7.991,
      10.7748
    ],
    "commodities": [
      "lead",
      "barite",
      "gold"
    ],
    "occurrences": 124,
    "prospectivity": 72,
    "risk": "high",
    "titles": 151,
    "petroleum": false,
    "coverage": 78
  },
  "Yobe": {
    "code": "YO",
    "region": "North East",
    "centroid": [
      12.3008,
      11.4298
    ],
    "commodities": [
      "kaolin",
      "gypsum",
      "iron"
    ],
    "occurrences": 38,
    "prospectivity": 31,
    "risk": "high",
    "titles": 41,
    "petroleum": false,
    "coverage": 57
  },
  "Zamfara": {
    "code": "ZA",
    "region": "North West",
    "centroid": [
      12.1209,
      6.2226
    ],
    "commodities": [
      "gold",
      "lead",
      "iron"
    ],
    "occurrences": 224,
    "prospectivity": 96,
    "risk": "high",
    "titles": 268,
    "petroleum": false,
    "coverage": 90
  }
};

export const DEPOSITS = [
  {
    "id": "NMI-0001",
    "name": "Anka Gold Field",
    "lat": 12.115,
    "lng": 5.933,
    "resource": "gold",
    "tier": "major",
    "state": "Zamfara",
    "status": "Producing"
  },
  {
    "id": "NMI-0002",
    "name": "Maru Gold Belt",
    "lat": 12.335,
    "lng": 6.4,
    "resource": "gold",
    "tier": "major",
    "state": "Zamfara",
    "status": "Producing"
  },
  {
    "id": "NMI-0003",
    "name": "Bukkuyum Gold",
    "lat": 11.92,
    "lng": 5.47,
    "resource": "gold",
    "tier": "minor",
    "state": "Zamfara",
    "status": "Exploration"
  },
  {
    "id": "NMI-0004",
    "name": "Birnin Gwari Gold",
    "lat": 11.05,
    "lng": 6.55,
    "resource": "gold",
    "tier": "major",
    "state": "Kaduna",
    "status": "Producing"
  },
  {
    "id": "NMI-0005",
    "name": "Kagoro Gold Prospect",
    "lat": 9.61,
    "lng": 8.39,
    "resource": "gold",
    "tier": "minor",
    "state": "Kaduna",
    "status": "Exploration"
  },
  {
    "id": "NMI-0006",
    "name": "Ilesha Gold Schist",
    "lat": 7.62,
    "lng": 4.73,
    "resource": "gold",
    "tier": "major",
    "state": "Osun",
    "status": "Producing"
  },
  {
    "id": "NMI-0007",
    "name": "Iperindo Gold",
    "lat": 7.53,
    "lng": 4.86,
    "resource": "gold",
    "tier": "minor",
    "state": "Osun",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0008",
    "name": "Okolom-Dogondaji Gold",
    "lat": 12.58,
    "lng": 4.95,
    "resource": "gold",
    "tier": "minor",
    "state": "Kebbi",
    "status": "Exploration"
  },
  {
    "id": "NMI-0009",
    "name": "Kaiama Gold Prospect",
    "lat": 9.6,
    "lng": 3.94,
    "resource": "gold",
    "tier": "minor",
    "state": "Kwara",
    "status": "Exploration"
  },
  {
    "id": "NMI-0010",
    "name": "Isanlu Gold",
    "lat": 8.27,
    "lng": 5.8,
    "resource": "gold",
    "tier": "minor",
    "state": "Kogi",
    "status": "Exploration"
  },
  {
    "id": "NMI-0011",
    "name": "Nasarawa Eggon Lithium",
    "lat": 8.73,
    "lng": 8.75,
    "resource": "lithium",
    "tier": "major",
    "state": "Nasarawa",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0012",
    "name": "Keffi Pegmatite Field",
    "lat": 8.85,
    "lng": 7.87,
    "resource": "lithium",
    "tier": "major",
    "state": "Nasarawa",
    "status": "Exploration"
  },
  {
    "id": "NMI-0013",
    "name": "Wamba Lithium Belt",
    "lat": 8.94,
    "lng": 8.6,
    "resource": "lithium",
    "tier": "minor",
    "state": "Nasarawa",
    "status": "Exploration"
  },
  {
    "id": "NMI-0014",
    "name": "Kushaka Lithium",
    "lat": 10.05,
    "lng": 6.5,
    "resource": "lithium",
    "tier": "major",
    "state": "Niger",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0015",
    "name": "Gbako Pegmatites",
    "lat": 9.21,
    "lng": 6.05,
    "resource": "lithium",
    "tier": "minor",
    "state": "Niger",
    "status": "Exploration"
  },
  {
    "id": "NMI-0016",
    "name": "Ijero Pegmatite",
    "lat": 7.82,
    "lng": 5.07,
    "resource": "lithium",
    "tier": "minor",
    "state": "Ekiti",
    "status": "Exploration"
  },
  {
    "id": "NMI-0017",
    "name": "Jos Plateau Tin Field",
    "lat": 9.89,
    "lng": 8.86,
    "resource": "tin",
    "tier": "major",
    "state": "Plateau",
    "status": "Producing"
  },
  {
    "id": "NMI-0018",
    "name": "Bukuru Tin Mines",
    "lat": 9.79,
    "lng": 8.86,
    "resource": "tin",
    "tier": "major",
    "state": "Plateau",
    "status": "Producing"
  },
  {
    "id": "NMI-0019",
    "name": "Riruwai Tin-Columbite",
    "lat": 10.71,
    "lng": 8.75,
    "resource": "tin",
    "tier": "minor",
    "state": "Kano",
    "status": "Producing"
  },
  {
    "id": "NMI-0020",
    "name": "Jema'a Cassiterite",
    "lat": 9.42,
    "lng": 8.37,
    "resource": "tin",
    "tier": "minor",
    "state": "Kaduna",
    "status": "Exploration"
  },
  {
    "id": "NMI-0021",
    "name": "Bauchi Tin Field",
    "lat": 10.1,
    "lng": 9.7,
    "resource": "tin",
    "tier": "minor",
    "state": "Bauchi",
    "status": "Exploration"
  },
  {
    "id": "NMI-0022",
    "name": "Itakpe Iron Ore",
    "lat": 7.61,
    "lng": 6.33,
    "resource": "iron",
    "tier": "major",
    "state": "Kogi",
    "status": "Producing"
  },
  {
    "id": "NMI-0023",
    "name": "Ajaokuta Iron Complex",
    "lat": 7.55,
    "lng": 6.66,
    "resource": "iron",
    "tier": "major",
    "state": "Kogi",
    "status": "Producing"
  },
  {
    "id": "NMI-0024",
    "name": "Agbaja Ironstone",
    "lat": 7.96,
    "lng": 6.64,
    "resource": "iron",
    "tier": "minor",
    "state": "Kogi",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0025",
    "name": "Koton Karfe Iron",
    "lat": 8.03,
    "lng": 6.73,
    "resource": "iron",
    "tier": "minor",
    "state": "Kogi",
    "status": "Exploration"
  },
  {
    "id": "NMI-0026",
    "name": "Muro Hills Iron",
    "lat": 9.05,
    "lng": 8.42,
    "resource": "iron",
    "tier": "minor",
    "state": "Nasarawa",
    "status": "Exploration"
  },
  {
    "id": "NMI-0027",
    "name": "Azara Barite Field",
    "lat": 8.2,
    "lng": 9.15,
    "resource": "barite",
    "tier": "major",
    "state": "Nasarawa",
    "status": "Producing"
  },
  {
    "id": "NMI-0028",
    "name": "Ibi Barite",
    "lat": 8.18,
    "lng": 9.74,
    "resource": "barite",
    "tier": "minor",
    "state": "Taraba",
    "status": "Producing"
  },
  {
    "id": "NMI-0029",
    "name": "Gabu Barite",
    "lat": 7.1,
    "lng": 9.4,
    "resource": "barite",
    "tier": "minor",
    "state": "Benue",
    "status": "Exploration"
  },
  {
    "id": "NMI-0030",
    "name": "Lessel Barite",
    "lat": 7.05,
    "lng": 9.0,
    "resource": "barite",
    "tier": "minor",
    "state": "Benue",
    "status": "Producing"
  },
  {
    "id": "NMI-0031",
    "name": "Ameka Lead-Zinc",
    "lat": 6.15,
    "lng": 8.04,
    "resource": "lead",
    "tier": "major",
    "state": "Ebonyi",
    "status": "Producing"
  },
  {
    "id": "NMI-0032",
    "name": "Ishiagu Lead-Zinc",
    "lat": 5.94,
    "lng": 7.52,
    "resource": "lead",
    "tier": "major",
    "state": "Ebonyi",
    "status": "Producing"
  },
  {
    "id": "NMI-0033",
    "name": "Enyigba Lead Field",
    "lat": 6.2,
    "lng": 8.15,
    "resource": "lead",
    "tier": "major",
    "state": "Ebonyi",
    "status": "Producing"
  },
  {
    "id": "NMI-0034",
    "name": "Abakaliki Lead Belt",
    "lat": 6.32,
    "lng": 8.11,
    "resource": "lead",
    "tier": "minor",
    "state": "Ebonyi",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0035",
    "name": "Zurak Lead-Zinc",
    "lat": 9.05,
    "lng": 9.63,
    "resource": "lead",
    "tier": "minor",
    "state": "Plateau",
    "status": "Exploration"
  },
  {
    "id": "NMI-0036",
    "name": "Arufu Lead-Zinc",
    "lat": 7.95,
    "lng": 9.4,
    "resource": "lead",
    "tier": "minor",
    "state": "Taraba",
    "status": "Exploration"
  },
  {
    "id": "NMI-0037",
    "name": "Mfamosing Limestone",
    "lat": 5.06,
    "lng": 8.48,
    "resource": "limestone",
    "tier": "major",
    "state": "Cross River",
    "status": "Producing"
  },
  {
    "id": "NMI-0038",
    "name": "Ewekoro Limestone",
    "lat": 6.91,
    "lng": 3.21,
    "resource": "limestone",
    "tier": "major",
    "state": "Ogun",
    "status": "Producing"
  },
  {
    "id": "NMI-0039",
    "name": "Okpella Limestone",
    "lat": 7.25,
    "lng": 6.32,
    "resource": "limestone",
    "tier": "major",
    "state": "Edo",
    "status": "Producing"
  },
  {
    "id": "NMI-0040",
    "name": "Obajana Limestone",
    "lat": 8.15,
    "lng": 6.44,
    "resource": "limestone",
    "tier": "major",
    "state": "Kogi",
    "status": "Producing"
  },
  {
    "id": "NMI-0041",
    "name": "Sokoto Limestone",
    "lat": 13.01,
    "lng": 5.24,
    "resource": "limestone",
    "tier": "minor",
    "state": "Sokoto",
    "status": "Producing"
  },
  {
    "id": "NMI-0042",
    "name": "Gboko Limestone",
    "lat": 7.32,
    "lng": 9.0,
    "resource": "limestone",
    "tier": "major",
    "state": "Benue",
    "status": "Producing"
  },
  {
    "id": "NMI-0043",
    "name": "Enugu Coal Measures",
    "lat": 6.44,
    "lng": 7.5,
    "resource": "coal",
    "tier": "major",
    "state": "Enugu",
    "status": "Producing"
  },
  {
    "id": "NMI-0044",
    "name": "Okaba Coal Field",
    "lat": 7.58,
    "lng": 7.45,
    "resource": "coal",
    "tier": "minor",
    "state": "Kogi",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0045",
    "name": "Ezimo Coal",
    "lat": 6.83,
    "lng": 7.55,
    "resource": "coal",
    "tier": "minor",
    "state": "Enugu",
    "status": "Exploration"
  },
  {
    "id": "NMI-0046",
    "name": "Igbeti Marble",
    "lat": 8.74,
    "lng": 4.13,
    "resource": "marble",
    "tier": "minor",
    "state": "Oyo",
    "status": "Producing"
  },
  {
    "id": "NMI-0047",
    "name": "Jakura Marble",
    "lat": 8.47,
    "lng": 6.2,
    "resource": "marble",
    "tier": "major",
    "state": "Kogi",
    "status": "Producing"
  },
  {
    "id": "NMI-0048",
    "name": "Agbabu Bitumen",
    "lat": 6.52,
    "lng": 4.8,
    "resource": "bitumen",
    "tier": "major",
    "state": "Ondo",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0049",
    "name": "Loda Tar Sands",
    "lat": 6.61,
    "lng": 4.95,
    "resource": "bitumen",
    "tier": "minor",
    "state": "Ondo",
    "status": "Exploration"
  },
  {
    "id": "NMI-0050",
    "name": "Bonny Oil Terminal",
    "lat": 4.43,
    "lng": 7.17,
    "resource": "oil",
    "tier": "major",
    "state": "Rivers",
    "status": "Producing"
  },
  {
    "id": "NMI-0051",
    "name": "Forcados Field",
    "lat": 5.35,
    "lng": 5.35,
    "resource": "oil",
    "tier": "major",
    "state": "Delta",
    "status": "Producing"
  },
  {
    "id": "NMI-0052",
    "name": "Brass Field",
    "lat": 4.32,
    "lng": 6.24,
    "resource": "oil",
    "tier": "major",
    "state": "Bayelsa",
    "status": "Producing"
  },
  {
    "id": "NMI-0053",
    "name": "Qua Iboe Field",
    "lat": 4.47,
    "lng": 8.0,
    "resource": "oil",
    "tier": "major",
    "state": "Akwa Ibom",
    "status": "Producing"
  },
  {
    "id": "NMI-0054",
    "name": "Escravos Field",
    "lat": 5.6,
    "lng": 5.19,
    "resource": "oil",
    "tier": "major",
    "state": "Delta",
    "status": "Producing"
  },
  {
    "id": "NMI-0055",
    "name": "Agbami Deepwater",
    "lat": 3.9,
    "lng": 4.5,
    "resource": "oil",
    "tier": "major",
    "state": "Offshore",
    "status": "Producing"
  },
  {
    "id": "NMI-0056",
    "name": "Bonga Deepwater",
    "lat": 4.15,
    "lng": 4.9,
    "resource": "oil",
    "tier": "major",
    "state": "Offshore",
    "status": "Producing"
  },
  {
    "id": "NMI-0057",
    "name": "Egina Deepwater",
    "lat": 4.05,
    "lng": 5.6,
    "resource": "oil",
    "tier": "minor",
    "state": "Offshore",
    "status": "Producing"
  },
  {
    "id": "NMI-0058",
    "name": "Oso Condensate",
    "lat": 4.25,
    "lng": 8.3,
    "resource": "oil",
    "tier": "minor",
    "state": "Akwa Ibom",
    "status": "Producing"
  },
  {
    "id": "NMI-0059",
    "name": "Utorogu Gas Plant",
    "lat": 5.47,
    "lng": 5.73,
    "resource": "gas",
    "tier": "major",
    "state": "Delta",
    "status": "Producing"
  },
  {
    "id": "NMI-0060",
    "name": "Oben Gas Field",
    "lat": 6.47,
    "lng": 5.9,
    "resource": "gas",
    "tier": "major",
    "state": "Edo",
    "status": "Producing"
  },
  {
    "id": "NMI-0061",
    "name": "Bonny NLNG",
    "lat": 4.42,
    "lng": 7.16,
    "resource": "gas",
    "tier": "major",
    "state": "Rivers",
    "status": "Producing"
  },
  {
    "id": "NMI-0062",
    "name": "Assa North Gas",
    "lat": 5.49,
    "lng": 6.98,
    "resource": "gas",
    "tier": "major",
    "state": "Imo",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0063",
    "name": "Ohaji South Gas",
    "lat": 5.42,
    "lng": 6.85,
    "resource": "gas",
    "tier": "minor",
    "state": "Imo",
    "status": "Appraisal"
  },
  {
    "id": "NMI-0064",
    "name": "Anambra Basin Gas",
    "lat": 6.1,
    "lng": 6.8,
    "resource": "gas",
    "tier": "minor",
    "state": "Anambra",
    "status": "Exploration"
  }
];

export const HEAT = [
  {
    "lat": 12.15,
    "lng": 6.05,
    "w": 1.0,
    "i": 0.95,
    "resource": "gold"
  },
  {
    "lat": 11.85,
    "lng": 5.55,
    "w": 0.8,
    "i": 0.8,
    "resource": "gold"
  },
  {
    "lat": 12.4,
    "lng": 6.45,
    "w": 0.75,
    "i": 0.78,
    "resource": "gold"
  },
  {
    "lat": 11.05,
    "lng": 6.55,
    "w": 0.85,
    "i": 0.82,
    "resource": "gold"
  },
  {
    "lat": 7.62,
    "lng": 4.75,
    "w": 0.7,
    "i": 0.74,
    "resource": "gold"
  },
  {
    "lat": 8.78,
    "lng": 8.55,
    "w": 0.95,
    "i": 0.9,
    "resource": "lithium"
  },
  {
    "lat": 9.95,
    "lng": 6.45,
    "w": 0.8,
    "i": 0.8,
    "resource": "lithium"
  },
  {
    "lat": 9.85,
    "lng": 8.85,
    "w": 0.9,
    "i": 0.86,
    "resource": "tin"
  },
  {
    "lat": 7.7,
    "lng": 6.45,
    "w": 0.85,
    "i": 0.83,
    "resource": "iron"
  },
  {
    "lat": 6.15,
    "lng": 8.05,
    "w": 0.8,
    "i": 0.79,
    "resource": "lead"
  },
  {
    "lat": 4.75,
    "lng": 6.3,
    "w": 1.15,
    "i": 0.9,
    "resource": "oil"
  },
  {
    "lat": 4.45,
    "lng": 7.3,
    "w": 0.95,
    "i": 0.86,
    "resource": "oil"
  },
  {
    "lat": 5.4,
    "lng": 5.45,
    "w": 0.9,
    "i": 0.84,
    "resource": "oil"
  },
  {
    "lat": 4.2,
    "lng": 5.1,
    "w": 0.85,
    "i": 0.7,
    "resource": "oil"
  }
];

export const RESOURCE_META = {
  "gold": {
    "label": "Gold",
    "color": "var(--c-gold)",
    "hex": "#f5b942",
    "cat": "Metallic"
  },
  "lithium": {
    "label": "Lithium",
    "color": "var(--c-lithium)",
    "hex": "#8b7dff",
    "cat": "Metallic"
  },
  "tin": {
    "label": "Tin / Columbite",
    "color": "var(--c-tin)",
    "hex": "#2dd8c3",
    "cat": "Metallic"
  },
  "iron": {
    "label": "Iron Ore",
    "color": "var(--c-iron)",
    "hex": "#ff8a3d",
    "cat": "Metallic"
  },
  "lead": {
    "label": "Lead / Zinc",
    "color": "var(--c-lead)",
    "hex": "#9aa7b0",
    "cat": "Metallic"
  },
  "barite": {
    "label": "Barite",
    "color": "var(--c-barite)",
    "hex": "#d6c9a8",
    "cat": "Industrial"
  },
  "limestone": {
    "label": "Limestone",
    "color": "#b8c4c9",
    "hex": "#b8c4c9",
    "cat": "Industrial"
  },
  "marble": {
    "label": "Marble",
    "color": "#c9d6d9",
    "hex": "#c9d6d9",
    "cat": "Industrial"
  },
  "coal": {
    "label": "Coal",
    "color": "#7d8a94",
    "hex": "#7d8a94",
    "cat": "Energy"
  },
  "bitumen": {
    "label": "Bitumen",
    "color": "#a08b6a",
    "hex": "#a08b6a",
    "cat": "Energy"
  },
  "oil": {
    "label": "Crude Oil",
    "color": "var(--c-oil)",
    "hex": "#00e676",
    "cat": "Energy"
  },
  "gas": {
    "label": "Natural Gas",
    "color": "var(--c-gas)",
    "hex": "#37d6ff",
    "cat": "Energy"
  },
  "kaolin": {
    "label": "Kaolin",
    "color": "#cfd8dc",
    "hex": "#cfd8dc",
    "cat": "Industrial"
  },
  "gypsum": {
    "label": "Gypsum",
    "color": "#bfc9c4",
    "hex": "#bfc9c4",
    "cat": "Industrial"
  },
  "talc": {
    "label": "Talc",
    "color": "#d2dcd8",
    "hex": "#d2dcd8",
    "cat": "Industrial"
  },
  "granite": {
    "label": "Granite",
    "color": "#9fb0b8",
    "hex": "#9fb0b8",
    "cat": "Industrial"
  },
  "clay": {
    "label": "Clay",
    "color": "#b5a894",
    "hex": "#b5a894",
    "cat": "Industrial"
  }
};

export const COMMODITIES = [
  {
    "id": "gold",
    "label": "Gold",
    "n": 486,
    "pct": 100,
    "trend": "up"
  },
  {
    "id": "limestone",
    "label": "Limestone",
    "n": 412,
    "pct": 85,
    "trend": "up"
  },
  {
    "id": "lead",
    "label": "Lead / Zinc",
    "n": 338,
    "pct": 70,
    "trend": "flat"
  },
  {
    "id": "barite",
    "label": "Barite",
    "n": 274,
    "pct": 56,
    "trend": "up"
  },
  {
    "id": "tin",
    "label": "Tin / Columbite",
    "n": 249,
    "pct": 51,
    "trend": "down"
  },
  {
    "id": "iron",
    "label": "Iron Ore",
    "n": 218,
    "pct": 45,
    "trend": "up"
  },
  {
    "id": "lithium",
    "label": "Lithium",
    "n": 164,
    "pct": 34,
    "trend": "up"
  },
  {
    "id": "coal",
    "label": "Coal",
    "n": 132,
    "pct": 27,
    "trend": "flat"
  }
];

export const ACTIVITY = [
  {
    "t": "New lithium pegmatite cluster delineated \u2014 Nasarawa Eggon",
    "src": "NGSA-FIELD",
    "time": "12 min ago",
    "color": "var(--purple)"
  },
  {
    "t": "Prospectivity model v4.2 rerun for North West zone",
    "src": "NMI-ENGINE",
    "time": "48 min ago",
    "color": "var(--green)"
  },
  {
    "t": "Security advisory raised to HIGH \u2014 Anka / Bukkuyum LGA",
    "src": "RISK-INTEL",
    "time": "2 hr ago",
    "color": "var(--red)"
  },
  {
    "t": "Sentinel-2 mosaic refreshed \u2014 100% national coverage",
    "src": "EO-PIPELINE",
    "time": "5 hr ago",
    "color": "var(--gold)"
  },
  {
    "t": "14 mining titles transitioned to expired status",
    "src": "CADASTRE",
    "time": "9 hr ago",
    "color": "var(--cyan)"
  },
  {
    "t": "Airborne magnetic survey ingested \u2014 Kogi block 7",
    "src": "GEOPHYS",
    "time": "1 day ago",
    "color": "var(--blue)"
  }
];
