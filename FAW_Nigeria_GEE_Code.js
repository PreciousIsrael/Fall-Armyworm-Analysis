/*This code is to produce a simple FAW susceptibility map of Nigeria for 9th August 2025

The important bioclimatic parameters (variables) for the occurrence of FAW are the following:
1. Surface radiative temperature (K)
2. Soil moisture (0 - 10 cm underground)
3. Vegetation type
4. Net thermal radiation
5. Aluminium
6. Nitrogen
7. 2025 NDVI
8. Total precipitation rate
*/

// Create suitability map for Nigeria
//Load the World Admin Boundaries
var adminBoundaries = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level0");
var Nigeria_boundary = adminBoundaries.filter(ee.Filter.inList("ADM0_NAME", ['Nigeria']));
print("Nigeria_boundary", Nigeria_boundary);

// Study date
var date = '2025-08-09';
var startDate = '2025-08-01';
var endDate = '2025-09-01';  //monthly window to ensure data availability

// 1. Surface Radiative Temperature 
//Load the monthly surface Radiative Temperature in FLDAS

var surface_radiative_temp = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
                   .select("RadT_tavg") 
                   .filter(ee.Filter.date('2025-08-01', '2025-09-01'))
                   .mean()
                   .unmask(0)                // fix data gaps before clipping
                   .clip(Nigeria_boundary);
                   
print("surface_radiative_temp", surface_radiative_temp);

// 2. Soil moisture (0 - 10 cm underground)
//Load the Soil moisture (0 - 10 cm underground) in FLDAS

var soil_moisture = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
              .select('SoilMoi00_10cm_tavg')
              .filterDate('2025-08-01', '2025-09-01')
              .mean()
              .unmask(0)                // fix data gaps before clipping
              .clip(Nigeria_boundary);
             
print("soil_moisture",soil_moisture);

//3.Vegetation type
//Load the dataset in ERA5

var vegetation_type = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
              .select('leaf_area_index_high_vegetation')
              .filterDate('2025-08-01', '2025-09-01')
              .mean()
              .unmask(0)                // fix data gaps before clipping
              .clip(Nigeria_boundary);
             
print("vegetation_type", vegetation_type);

// 4. Net thermal radiation at the surface.
//Load the dataset in ERA5

var net_thermal_radiation = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
                    .select("surface_net_thermal_radiation_sum")
                    .filterDate('2025-08-01', '2025-09-01')
                    .mean()
                    .unmask(0)                // fix data gaps before clipping
                    .clip(Nigeria_boundary);
                    
print("net_thermal_radiation", net_thermal_radiation);

//5. Aluminium mean
//Load dataset from iSDAsoil extractable Aluminium

var aluminium = ee.Image("ISDASOIL/Africa/v1/aluminium_extractable") //Dataset availability is from 2001 to 2017, 2025 not included 
                    .select("mean_0_20")
                    .unmask(0)                // fix data gaps before clipping
                    .clip(Nigeria_boundary);
                    
print ("aluminium", aluminium);

// 6.  Nitrogen mean
//Load dataset from iSDAsoil Total Nitrogen//
var nitrogen = ee.Image("ISDASOIL/Africa/v1/nitrogen_total") //Dataset availability is from 2001 to 2017, 2025 not included
                    .select("mean_0_20")
                    .unmask(0)                // fix data gaps before clipping
                    .clip(Nigeria_boundary);
                    
print ("nitrogen", nitrogen);

// 7. 2025 NDVI
//Load Sentinel2 Data

function maskS2clouds(image) {
  var qa = image.select('QA60');
  
  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
               .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask);
}

var NDVI = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                    .filterBounds(Nigeria_boundary)
                    .filterDate('2024-01-01', '2026-01-01')  
                    .select(['B4', 'B8', 'QA60'])       //B4 - Red band, B8 - Near Infrared band
                    // Pre-filter to get less cloudy granules.
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                    .map(maskS2clouds)    // apply the cloud mask
                    .median()             // preffered for vegetation index and gives an image
                    .multiply(0.0001);
                    
//Formular to compute NDVI
var ndvi = NDVI.normalizedDifference(['B8', 'B4']).clip(Nigeria_boundary);
print ("ndvi", ndvi);

//8. Total precipitation
//Load Dataset in FLDAS

var total_precipitation_rate = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
                                      .select("Rainf_f_tavg")
                                      .filterDate('2025-08-01', '2025-09-01')
                                      .mean()
                                      .clip(Nigeria_boundary);
                                      
print ("total_precipitation_rate", total_precipitation_rate);                  


// USE THE METHOD OF RECLASSIFICATION TO ASSIGN SUITABILITY VALUES

// Surface radiative temperature 
// Not suitable: lt(297.5) or gt(307.0) | Suitable: otherwise (between 297.5 and 307.0)

var surface_radiative_temp_suit = surface_radiative_temp
                      .where(surface_radiative_temp.gte(297.5).and(surface_radiative_temp.lte(307.0)), 1) // suitable
                      .where(surface_radiative_temp.lt(297.5).or(surface_radiative_temp.gt(307.0)), 0);    //not suitable
                    
print("surface_radiative_temp_suit", surface_radiative_temp_suit);

// Soil moisture 
// Not suitable: gt(0.39) | Suitable: otherwise (lte 0.39)

var soil_moisture_suit = soil_moisture.where(soil_moisture.lte(0.39), 1) //suitable
                        .where(soil_moisture.gt(0.39), 0);     //not suitable
                    
print("soil_moisture_suit", soil_moisture_suit);

// Vegetation type 
// Not suitable: lt(1.287) or gt(2.324) | Suitable: otherwise (between 1.287 and 2.324)

var vegetation_type_suit = vegetation_type.where(vegetation_type.gte(1.287).and(vegetation_type.lte(2.324)), 1) //suitable
                    .where(vegetation_type.lt(1.287).or(vegetation_type.gt(2.324)), 0);   //not suitable
                    
print("vegetation_type_suit", vegetation_type_suit);

// Net thermal radiation 
// Not suitable: lt(-12500000) or gt(-1120559) | Suitable: otherwise (between -12500000 and -1120559)

var net_thermal_radiation_suit = net_thermal_radiation.where(net_thermal_radiation.gte(-12500000).and(net_thermal_radiation.lte(-1120559)), 1)  //suitable
                    .where(net_thermal_radiation.lt(-12500000).or(net_thermal_radiation.gt(-1120559)), 0);  //not suitable
        
print("net_thermal_radiation_suit", net_thermal_radiation_suit);

// Aluminium
// Not suitable: lt(22) or gt(47) | Suitable: otherwise (between 22 and 47)

var aluminium_suit = aluminium.where(aluminium.gte(22).and(aluminium.lte(47)), 1) //suitable
                              .where(aluminium.lt(22).or(aluminium.gt(47)), 0);   //not suitable

print("aluminium_suit", aluminium_suit);

// Nitrogen 
// Not suitable: lt(28) or gt(68) | Suitable: otherwise (between 28 and 68)

var nitrogen_suit = nitrogen.where(nitrogen.gte(28).and(nitrogen.lte(68)), 1)
                    .where(nitrogen.lt(28).or(nitrogen.gt(68)), 0);
                    
print("nitrogen_suit", nitrogen_suit);

// ndvi 
// Not suitable: lt(0.1021) or gt(0.6880) | Suitable: otherwise (between 0.1021 and 0.6880)

var ndvi_suit = ndvi.where(ndvi.gte(0.1021).and(ndvi.lte(0.6880)), 1) //suitable
                    .where(ndvi.lt(0.1021).or(ndvi.gt(0.6880)), 0);   //not suitable

print("ndvi_suit", ndvi_suit);

// Total precipitation rate
// Not suitable: lt(5.485e-08) or gt(1.098e-04) | Suitable: otherwise (between 5.485e-08 and 1.098e-04)

var total_precipitation_rate_suit = total_precipitation_rate
                                    .where(total_precipitation_rate.gte(5.485e-08).and(total_precipitation_rate.lte(1.098e-04)), 1)  //suitable
                                    .where(total_precipitation_rate.lt(5.485e-08).or(total_precipitation_rate.gt(1.098e-04)), 0); //not suitable
 
print("total_precipitation_rate_suit", total_precipitation_rate_suit);

//Rank of parameters & AHP - building the matrix
//Weights are used to indicate the relative importance of each variable,
var rank = [7,6,5,4,3,3,2,1]; // In this case 2 variables are equally important,  
  var matrix = [];
  for (var i in rank){
    matrix[i]=[];
    for (var j in rank){
      if (rank[i]>rank[j]){
        matrix[i][j] = 1;
      }
      else if (rank[i]<rank[j]){
        matrix[i][j] = 3;
      }
      else{
        matrix[i][j] = 2;
      }
    }
  }
  
  // Setting all major diagonal elements to zero
  for (var i = 0; i < rank.length; i++){
    for (var j = 0; j < rank.length; j++){
      if (i==j){
        matrix[i][j]=0;
      }
    }
  }
  
  //print('Analytic Hierarchy Process (AHP) Matrix', matrix);
  
  // Sum of columns
  var colSum = [];
  for(var i = 0; i < matrix.length; i++){
   for(var j = 0; j < matrix[i].length; j++){
    colSum[j] = (colSum[j] || 0) + matrix[i][j];
   }
  }
  
  // Sum of all elements of AHP Matrix
  var sum = 0;
  for (var i = 0; i < colSum.length; i++) {
    sum += colSum[i];
  }
  //print(sum);
  
  var weightList = [];
  for (var i = 0; i < colSum.length; i++) {
    weightList[i] = colSum[i]/sum;
  }
  print('Criteria/Parameter Weights', weightList);
  
/*Using the AHP code to apportion weight to the different parameters, the weights are as follows
0: 0.1875
1: 0.16964285714285715
2: 0.15178571428571427
3: 0.13392857142857142
4: 0.10714285714285714
5: 0.10714285714285714
6: 0.08035714285714286
7: 0.0625*/

//final suitability by combining all the parameters suitabilities

var final_faw_suit = surface_radiative_temp_suit.multiply(0.1875)
                           .add(soil_moisture_suit.multiply(0.16964285714285715))
                           .add(vegetation_type_suit.multiply(0.15178571428571427))
                           .add(net_thermal_radiation_suit.multiply(0.13392857142857142))
                           .add(aluminium_suit.multiply(0.10714285714285714))
                           .add(nitrogen_suit.multiply(0.10714285714285714))
                           .add(ndvi_suit.multiply(0.08035714285714286))
                           .add(total_precipitation_rate_suit.multiply(0.0625))
                           .rename("Combined_susceptibility");
                           
print("final_faw_suit", final_faw_suit);

//Centre the map at the study area

Map.centerObject(Nigeria_boundary, 6);
Map.addLayer(Nigeria_boundary, {}, "Nigeria_boundary");

// Visualization of image of all parameters

Map.addLayer(surface_radiative_temp, {min:290, max:320, palette:['blue','green','yellow','red']}, 'Surface Radiative Temp', false);
Map.addLayer(soil_moisture, {min:0, max:0.5, palette:['blue','green','yellow','red']}, 'Soil Moisture', false);
Map.addLayer(vegetation_type, {min:0, max:5, palette:['blue','yellow','green','darkgreen']}, 'Vegetation Type', false);
Map.addLayer(net_thermal_radiation, {min:-2000000, max:2000000, palette:['blue','yellow','red']}, 'Net Thermal Radiation', false);
Map.addLayer(aluminium, {min:0, max:100, palette:['yellow','orange','red','brown']}, 'Aluminium', false);
Map.addLayer(nitrogen, {min:0, max:5, palette:['blue','yellow','green','darkgreen']}, 'Nitrogen', false);
Map.addLayer(ndvi, {min:0, max:1, palette:['blue','yellow','green','darkgreen']}, 'NDVI', false);
Map.addLayer(total_precipitation_rate, {min:0, max:0.0005, palette:['blue','green','yellow','red']}, 'Total Precipitation Rate', false);

// Visualization of image of all parameters suitability

Map.addLayer(surface_radiative_temp_suit, {min:0, max:1, palette: ['green','red']}, 'Surface Temp Suit', false);
Map.addLayer(soil_moisture_suit, {min: 0, max: 1, palette: ['green','red']}, 'Soil Moisture Suit', false);
Map.addLayer(vegetation_type_suit, {min: 0, max: 1, palette: ['green','red']}, 'Vegetation Type Suit', false);
Map.addLayer(net_thermal_radiation_suit, {min:0, max:1, palette: ['green','red']}, 'Net Thermal Radiation Suit', false);
Map.addLayer(aluminium_suit, {min: 0, max: 1, palette: ['green','red']}, 'Aluminium Suit', false);
Map.addLayer(nitrogen_suit, {min: 0, max: 1, palette: ['green','red']}, 'Nitrogen Suit', false);
Map.addLayer(ndvi_suit,{min:0, max:1, palette: ['green','red']}, 'NDVI Suit', false);
Map.addLayer(total_precipitation_rate_suit, {min:0, max:1, palette: ['green','red']}, 'Total Precipitation Rate Suit', false);
Map.addLayer(final_faw_suit, {min:0, max:1, palette: ['blue','green','yellow','red']} , 'Nigeria FAW Suit');

// Export final FAW suitability map
Export.image.toDrive({
  image: final_faw_suit,
  description: 'Nigeria_FAW_Suitmap',
  folder: 'WASCAL-ICC-Course',
  fileNamePrefix: 'Nigeria_FAW_Suitmap',
  scale: 1000,
  region: Nigeria_boundary.geometry(),
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

