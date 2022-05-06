document.addEventListener("DOMContentLoaded", function() { 
    let startMinutes = 24*60;
    let endMinutes = 0;

    let data = [];

    let svgWidth = window.innerWidth //+200; //> 700 ? 700:window.innerWidth ;
    let svgHeight =  svgWidth / 2 > window.innerHeight - 250 ? window.innerHeight - 250:svgWidth / 2;
    
    const margin = 5;
    const padding = 5;
    const adj = 30;

    var xScale, yScale, brush;
    const svgMarginTop = 30;
    const svgMarginBottom = 100;
    const svgMarginLeft = 0;

    let loadData = undefined;

    let allEvents = [];

    // TODO fix which activities are included >>> make them activities not devices!
    event_types = ['washing_and_drying','housework','dishwasher','kettle','microwave','oven',
                    'question_mark','toaster','air_cooling','heating','showering_and_hair-drying',
                    'computer','diy','hob','ironing','lighting','meal_breakfast','meal_lunch','meal_dinner',
                    'watching_tv'
                   ];

    let SHIFT_BY = 4;
    let WINDOW = 8;
    let FLAG = false;
    let sensorId = 100;
    let timeOfInactivity = 60000;
    let sunrise, sunset;
    const consumptionUnit = 1;

    // TODO make global
    const unitLUT = {
        "Temperature": '\xB0C',
        "Humidity": '%',
        "CO2": 'ppm',
        "TVOC": 'ppb',
        "PM 10.0": 'per 0.1L air',
        "PM 1.0": 'per 0.1L air',
        "PM 2.5": 'per 0.1L air'
    };

    const nameLUT = {
        "pm100_env": 'PM 10.0',
        "pm10_env": 'PM 1.0',
        "pm25_env": 'PM 2.5'
    };

    startTimer();

    function startTimer() { 
        // window.setTimeout returns an Id that can be used to start and stop a timer
        timeoutId = window.setTimeout(refreshData, timeOfInactivity)
    }

    function resetTimeOfInactivity(){
 
        window.clearTimeout(timeoutId)
        startTimer();

        timeOfInactivity = 2*60*1000;
    }

    // Periodical refresh if FLAG is down
    async function refreshData() {
        const measurement = 'electricity_consumption';
        const sensor_id = sensorId;
        let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-2&showAll=true&points=80`;
        if(FLAG == false){
            try{
                result = await d3.json(dataUrl);
                console.log(result.readings);

                formattedData = formatData(result.readings);
                
                let dd = [];

                // Checks that there are no duplicates pushed in the data
                // Assumes the the data array is sorted!
                formattedData.forEach( g => {
                    tmp = false;
                    for( i = data.length-1; i>=0;i--){
                        if(g.time.getTime() > data[i].time.getTime() && tmp==false ){
                            dd.push(g);
                            tmp = true;
                        }else if(data[i].time.getTime() <= g.time.getTime()){
                           return;
                        } 
                    }
                });

                data = data.concat(dd);

                data.sort((a,b)=> { return (new Date(a.start)) - (new Date(b.start));})
                updateGraph(data,false);
                resetTimeOfInactivity();
            }catch(e){
                console.log(e);
            }
        }
    }

    /*Creates SVG & its title*/
    const appendSvg = function (measurement) {
        let name = measurement.name;
    
        svgContainer = d3.select("div#container");


        // Check to see if it exists
        if(svgContainer.select('#'+measurement.id + 'Chart').node() !== null ){
            return;
        }

        // svgContainer
        //     .append("h4")
        //     .attr('id', measurement.id)
        //     .text(name);

        svgContainer
            .append("svg")
            .attr('id', measurement.id + 'Chart')
            .attr("preserveAspectRatio", "xMinYMin meet")
            // .attr('width',svgWidth)
            // .attr('height',svgHeight)
            .attr("viewBox", "-"
                + 1.5 * adj + " -"
                + 2.5*adj + " "
                + (svgWidth + adj*3) + " "
                + (svgHeight + adj*4))
            .style("padding", padding)
            .style("margin", margin)
            // .style("max-width", 600)
            .classed("svg-content", true);
    }

    const loadMeasurementData = function (series) {
        const measurement = series.measurement;
        const sensor_id = series.sensor_id;
        sensorId = sensor_id;

        let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-${startMinutes}&showAll=true&points=80`;
        if (endMinutes > 0) {
            dataUrl = dataUrl + `&end=-${endMinutes}`;
        }

        return d3.json(dataUrl).then(function (response) {
            drawGraphs(response,sensor_id,series);
        });
    }

    // TODO: remove because not used?
    function addDataToGraphs(response,sensor_id,series){
        let data = response.readings;
        data = data.map(function (d) {
            let v = +d.value + offset;
            if (d.value === null) {
                v = null;
            }
            return {
                time: luxon.DateTime.fromISO(d.time).toJSDate(),//timeConv(d.time),
                value: v
            }
        });
   
    }

    function formatData(data){
        let offset = 0;

        // console.log(data)

        data = data.map(function (d) {
            let v = +d.value + offset;
            if (d.value === null) {
                v = null;
            }
            return {
                time: luxon.DateTime.fromISO(d.time).toJSDate(),//timeConv(d.time),
                value: v
            }
        });
        return data;
    }

    // TODO check why data is not pushing
    function drawGraphs (response,sensor_id,series){

        let newdata = formatData(response.readings);

        let freshData = false;

        if(data.length == 0){ freshData = true; }
        
        data = data.concat(newdata);

        // data.sort( (a,b) => { return a.time - b.time})

        // Get initial min-max values for the x axis
        // If it is the first time the page is loaded show all
        // Else show an offest to avoid jumps in the scrollling

        // Check if data is empty, eg becase there are no values for today
        // force the max value as today and move backwards in time
        if(newdata.length == 0){
            max = new Date();
            min = max.getTime() - WINDOW * 60 * 60 *1000;
 
        }else{

            max = d3.max(newdata, d => new Date(d.time.getTime()));

            if(freshData == false) { max = new Date(max.getTime() + WINDOW*60*60*1000); };
            min = new Date(max);
            min.setHours(max.getHours() - WINDOW)
        }

        xScale = d3.scaleTime(
            // d3.extent(data, d => new Date(d.time.getTime())),
            [ min , max ],
            [0, svgWidth-svgMarginLeft]
        );

        yScale = d3.scaleLinear(
            [(0), 1.1 * d3.max(data, d => +d.value)],
            [svgHeight-svgMarginBottom, svgMarginTop]
        );
        
        let xAxis = d3.axisTop()
            .ticks(15)
            .tickSize(-svgHeight+svgMarginBottom)
            .tickFormat(d3.timeFormat('%b %d %H:%M'))
            .scale(xScale);

        let xAxisSecond = d3.axisBottom()
            .ticks(0)
            // .tickSize(-svgHeight+svgMarginBottom)
            // .tickFormat(d3.timeFormat('%b %d %H:%M'))
            .scale(xScale);

        let yAxis = d3.axisLeft()
            .scale(yScale); 

        let svg = d3.select('svg#' + series.id + 'Chart');
        // svg.selectAll("*").remove();
        svg.selectAll('.axis').remove();
        svg.selectAll('.annotationBar').remove();


        svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", "translate(0," + 0 + ")")
            .call(xAxis)
                .selectAll("text")  
                .style("text-anchor", "start")
                .attr("dx", ".8em")
                .attr("dy", "-.5em")
                .attr('y',0)
                // .attr("dx", "-.8em")
                // .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");
    
        svg.append("g")
            .attr("transform", "translate(0," + (svgHeight- svgMarginBottom ) + ")")
            .attr("class", "axis x-axis")
            .call(xAxisSecond)

        let label = series.name;
        if (label.includes(' (sensor')) {
            label = label.split(' (sensor')[0];
        }
        if (label in unitLUT) {
            label = `${series.name} (${unitLUT[label]})`;
        } else {
            label = series.name;
        }

        svg.append("g")
            .attr("class", "axis")
            .call(yAxis)
            .append("text")
                .attr("transform", "rotate(-90)")
                .attr("dy", ".75em")
                .attr("y", 6)
                .attr('x',-svgMarginTop)
                .style("text-anchor", "end")
                .text(label);
        
        svg.append('clipPath')
              .attr("id", "clip")
              .append('rect')
              .attr('x',xScale.range()[0])
              .attr('y',yScale.range()[1])
              .attr('width',xScale.range()[1]-xScale.range()[0])
              .attr('height',yScale.range()[0]-yScale.range()[1] + svgMarginBottom)

        // Add clipping path for making the animation look better
        svgGroup = svg.append("g").attr("class","dataPoints")
                        .attr("clip-path", "url(#clip)");

        updateGraph(data,true);
        getSunriseSunset(data);
        addBrushing(response);
        drawAnnotations();

        d3.select('#btnEarlier').on('click', getEarlierData);

        d3.select('#btnRecent').on('click', e => {

            resetTimeOfInactivity();

            tmp = xScale.domain();
            maxTime = new Date();
            minTime = maxTime - WINDOW * 60 * 60 *1000;
            // new Date(tmp[0].setHours(tmp[0].getHours()-SHIFT_BY));
            // minTime.setHours(maxTime.getHours()+WINDOW);

            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );

            updateXAxis();
            updateGraph(data,false);
            updateSunriseSunset();
            updateAnnotationBar();

        });
        
        d3.select('#btnLater').on('click', e =>{
            resetTimeOfInactivity()

            tmp = xScale.domain()
            minTime = new Date(tmp[0].setHours(tmp[0].getHours()+SHIFT_BY));
            maxTime = new Date(minTime);
            maxTime.setHours(maxTime.getHours()+WINDOW);

            // hardMaximum = minTime + WINDOW/2 * 60 * 60 * 1000
            if( maxTime > d3.max(data, d =>{ return d.time }) ){
                d3.select('#btnLater').classed('disabled',true)
                return;
            }

            d3.select('#btnEarlier').classed('disabled',false)
            
            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );

            updateXAxis();
            updateGraph(data,false)
            updateSunriseSunset();
            updateAnnotationBar();
        });

        d3.select('#btnScale24').on('click', e =>{
            WINDOW = 24;
            SHIFT_BY = 12;
            resetTimeOfInactivity();

            d3.selectAll('.scaleBtn').classed('selected',false)
            d3.select('#btnScale24').classed('selected',true)

            d3.select('#btnEarlier').classed('disabled',false)
            d3.select('#btnLater').classed('disabled',false)
            clearBrushSelection();
            d3.selectAll("div#container svg .brush").call(brush.move,null);

            tmp = xScale.domain()
            minTime = new Date(tmp[0]);
            maxTime = new Date(minTime);
            maxTime.setHours(maxTime.getHours()+WINDOW);

            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );

            updateXAxis();
            updateGraph(data)
            updateAnnotationBar();
            updateSunriseSunset();

        });

        d3.select('#btnScale8').on('click', e =>{
            WINDOW = 8;
            SHIFT_BY = 4;
            resetTimeOfInactivity();

            d3.selectAll('.scaleBtn').classed('selected',false)
            d3.select('#btnScale8').classed('selected',true)

            d3.select('#btnEarlier').classed('disabled',false)
            d3.select('#btnLater').classed('disabled',false)
            clearBrushSelection();
            d3.selectAll("div#container svg .brush").call(brush.move,null);

            tmp = xScale.domain()
            minTime = new Date(tmp[0]);
            maxTime = new Date(minTime);
            maxTime.setHours(maxTime.getHours()+WINDOW);

            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );

            updateXAxis();
            updateGraph(data)
            updateAnnotationBar();
            updateSunriseSunset();
       });

        d3.select('#btnScaleWeek').on('click', e =>{
            WINDOW = 24*7;
            SHIFT_BY = 24*4;
            resetTimeOfInactivity();

            d3.selectAll('.scaleBtn').classed('selected',false)
            d3.select('#btnScaleWeek').classed('selected',true)
            clearBrushSelection();
            d3.selectAll("div#container svg .brush").call(brush.move,null);

            tmp = xScale.domain()
            minTime = new Date(tmp[0]);
            maxTime = new Date(minTime);
            maxTime.setHours(maxTime.getHours()+WINDOW);

            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );

            updateXAxis();
            updateGraph(data)
            updateAnnotationBar();
            updateSunriseSunset();
        });

    }

    let seriesUrl = '/series/?showAll=true';
    // if (showAll !== true) {
    //     seriesUrl = '/series/';
    // }
    // if (daysParam !== undefined) {
    //     seriesUrl = seriesUrl + '&days=' + daysParam;
    // }
    
    d3.json(seriesUrl).then(function (allSeries) {
        console.log(allSeries)
        toKeep = "electricity_consumption";
        // toKeep = "TVOC";

        // "&& d.sensor_id==100;" >> temporary FIX!!
        allSeries = allSeries.filter(function (d) {
            return toKeep.includes(d.measurement) && (d.sensor_id <=100 && d.sensor_id >= 96);//d.sensor_id==2;
        });

        allSeries = allSeries.map(function (item) {
                const id = `${item.measurement}_${item.sensor_id}`;
                let name = item.measurement;
                if (name in nameLUT) {
                    name = nameLUT[name];
                } 
                // if (allSensors.length > 1) {
                //     name = `${name} (sensor #${item.sensor_id})`;
                // }
                // name = capitalize(name);
                
                return {
                    'measurement': item.measurement,
                    'sensor_id': item.sensor_id,
                    'name': name,
                    'id': id,
                };
            });

        loadData = function () {
            // d3.select("div#container").selectAll('div.graphContainer').remove();
            _series.forEach(m => appendSvg(m));
            d3.select('div.main-loading').style('display', 'block');
            const promises = _series.map(m => loadMeasurementData(m));
            Promise.all(promises).then( () => {
                console.log('all loaded');
                d3.select('div.main-loading').style('display', 'none');
            });
        };

        _series = allSeries.map( d => {return d;});

        loadData();

    });

    // TODO Check why so many nulls
    function updateGraph(dataF, firstCall){
        
        d3.select('.dataPoints').selectAll('rect')
            .data(dataF)
            .join("rect")
            .attr("width", () => {
                if( WINDOW == 24){ return 5; }
                else if (WINDOW == 24*7){ return 1;} 
                else{ return 3; }
            })
            .attr("height", d => {
                if (svgHeight-svgMarginBottom - yScale(d.value) < 0) {
                    return 0;
                } 
                if (d.value === null) {
                    return 0;
                } else {
                    return svgHeight-svgMarginBottom - yScale(d.value);
                }
            })
            .attr("y", d => { return yScale(d.value); })       

        // Only transition with existing data, 
        // avoid animation 
        if(!firstCall){
            d3.select('.dataPoints').selectAll('rect')
            .transition()
            .attr("x", d => { 
                return xScale(new Date(d.time.getTime())); })
        }else{
           d3.select('.dataPoints').selectAll('rect')
            .attr("x", d => { 
                return xScale(new Date(d.time.getTime())); })
        }
    
        d3.select('.dataPoints').selectAll('rect.annottated')
            .style('fill','steelblue')
    }

    function clearBrushSelection(){
        d3.select('.saveBtnContainer').remove();
        d3.selectAll('.dataPoints rect').style("opacity", '1');
    }

    function getEarlierData(e){
        resetTimeOfInactivity();

        tmp = xScale.domain();
        minTime = tmp[0] - SHIFT_BY * 60 * 60 *1000;
        // new Date(tmp[0].setHours(tmp[0].getHours()-SHIFT_BY));
        maxTime = new Date(minTime);
        maxTime.setHours(maxTime.getHours()+WINDOW);

        // Check if almost out of bounds
        if( minTime - SHIFT_BY/2 * 60 * 60 *1000 <= d3.min(data, d =>{ return d.time }) ||
            data.length == 0
         ){
            // GET EARLIER DATA
            // move backwards in time based on the 'startMinutes' measure
            // the endMinutes is set so as to not requery existing data
            console.log("CALLING NEW DATA")
            endMinutes = startMinutes.valueOf();
            startMinutes += startMinutes;
            loadData();
            // drawAnnotations();
        }
        d3.select('#btnLater').classed('disabled',false)
        d3.select('#btnRecent').classed('disabled',false)

        xScale = d3.scaleTime(
            [minTime , maxTime],
            [0, svgWidth-svgMarginLeft]
        );
        
        updateXAxis();
        updateGraph(data,false);
        updateSunriseSunset();
        updateAnnotationBar();
    };

    async function drawAnnotations(){

        try{
            result = await d3.json('/annotations');

            allEvents = result;
            allEvents.forEach( g => {

                tmpDate = new Date(g.start);

                // Highlight the annotated area
                d3.selectAll('.dataPoints rect').filter( d => { 
                    return d.time >= tmpDate && d.time <= (tmpDate.getTime() + (+g.duration_seconds));
                })
                .classed('annottated',true)

                addAnnotationBar(g, g.id);
            })
        }catch(e){
            console.log("error " + e)
        }
    }

    function addBrushing (response){
        brush = d3.brushX()
                        .extent([[0,svgMarginTop], [svgWidth+20, svgHeight-svgMarginBottom]])
                        .on('start', brushStart)
                        .on('end', brushEnd)
                        .on('brush', brushing)

        let brushContainer = d3.selectAll("div#container svg")
              .append("g")
              .attr('class','brush')
              .call(brush)

        function brushStart({selection}) {
            if(WINDOW == 24*7) { return }
            resetTimeOfInactivity();

            // console.log('brush started');
            d3.select('.saveBtnContainer').remove();
            
            d3.select('#infoBox').html('').style('display','none');

        }

        function brushEnd(event) {
            resetTimeOfInactivity();
            if (!event.sourceEvent) return;
            if(WINDOW == 24*7) { 
                d3.select('#infoBox').html('You cannot annotate at this scale.')
                clearBrushSelection();
                return
            }

            console.log('brush ended');
            selection = event.selection;

            allEvents.sort( (a,b) => { return new Date(b.start) - new Date(a.start); })

            // check it was not a random click
            if( selection && selection.length >= 2){

                // Check if started within a already annotated area
                // if so push to the nearest non-annotated right/left side
                let sx = selection.map(xScale.invert);
                /* let newStart = new Date (sx[0]),
                    newEnd = new Date (sx[1]),
                    flag = false;
    
                 for (const e of allEvents){
                    tmpStart = new Date(e.start);
                    tmpEnd = new Date(tmpStart.getTime() + (+e.duration_seconds));

                    if( sx[0] <= tmpStart && sx[1] >= tmpStart && flag == false){
                       newEnd = tmpStart;
                       flag = true;
                    }else if( sx[0] >= tmpStart && sx[0] <= tmpEnd && flag == false){
                       newStart = tmpEnd;
                       flag = true;
                    }

                    if(flag == true && newStart == tmpStart){
                       newStart = tmpEnd;
                       flag = false;
                    }
                }

                // check if start/end reversed
                sx = [newStart,newEnd];
                if( flag == true){
                    brushContainer.call(brush.move,sx.map(xScale))
                } */
                // Check if any of the brush is inside an existing annotation. If so 
                // return.
                for (const e of allEvents){
                    tmpStart = new Date(e.start);
                    tmpEnd = new Date(tmpStart.getTime() + (+e.duration_seconds));

                    if ( (sx[0] <= tmpEnd && sx[0]>= tmpStart) ||
                         (sx[1] <= tmpEnd && sx[1]>= tmpStart)){
                        clearBrushSelection();
                        brushContainer.call(brush.move,null);
                        d3.select('#infoBox').html('You cannot have overlapping annotations').style('display','block');
                        return;
                    }
                }
                
                // Create a button to save event
                d3.select('div#container svg')
                  .append('g')
                  .attr('class','saveBtnContainer')
                  .style('cursor','pointer')
                  .on('click', () => { createEvent(sx); })
                  // Show the save button aligned to the selection
                  .attr('transform', 'translate(' +(xScale(sx[0]) + (xScale(sx[1])-xScale(sx[0]))/2 - 50)+','+(svgMarginTop)+')')
                
                d3.select('.saveBtnContainer')
                    .append('rect')
                    .attr('id','saveButton')
                    .attr('width',100)
                    .attr('height',30)
                    .attr('rx',15)
                d3.select('.saveBtnContainer')
                    .append('text')
                    .text('SAVE')
                    .attr('dy',20)
                    .attr('dx',50)
                    .attr('text-anchor','middle')
                    .style('fill','white')
              
            }else{
                clearBrushSelection();
            }
        }

        function brushing({selection}) {
            console.log('brush hapenning')
            resetTimeOfInactivity();

            FLAG = true;

            if (selection === null) {
               clearBrushSelection();
            } else {
              const sx = selection.map(xScale.invert);

              d3.selectAll('.dataPoints rect').style("opacity", d => { 
                return sx[0] <= d.time && d.time <= sx[1] ? "1" : '0.2'; });
            }
        }

        function createEvent(selection){
            let evnt = {};

            d3.select('#dialogueBox h4').html('Create Event')
            d3.select('#dialogueBox').attr('isCreate','true')

            evnt.createdAt = (new Date()).toISOString()
            evnt.series = '';

            evnt.flexibility = ''
            evnt.description = ''

            // TODO: add more acccurate time mapping based on the bars not the brushing
            evnt.start = selection[0]; 
            evnt.end = selection[1];

            evnt.duration_seconds = evnt.end.getTime() - evnt.start.getTime();

            const event_readings = data.filter(d => {
                return (new Date(d.time)).getTime() >= evnt.start.getTime() && (new Date(d.time)).getTime() < evnt.end.getTime();
            });
            // TODO: add always on function
            evnt.consumption = d3.sum(event_readings, d => d.value); // - always_on;

            show_event_dialog(evnt);
        }

        function resetDialogue(){
            d3.select('#dialogueBox #infoBoxDialogue').html('').style('display','none');
           // evnt = {
           //  'start' :'',
           //  'end'   : '',
           //  'duration': 0,
           //  'consumption': 0,
           //  'id':'',
           //  'type':'',
           //  'notes':''
           // }

            // d3.select('#dialogueBox #evntDuration').html('');
            // d3.select('#dialogueBox #evntStart').html('');
            // d3.select('#dialogueBox #evntEnd').html('');
            // d3.select('#dialogueBox #evntConsumption').html('');
            // document.getElementById('#evntDescription').value = '';
            // d3.selectAll("#iconField img").classed('selected',false)
        }

        function getDialogueValues(type){
            resetTimeOfInactivity();

            let evnt = {};

            if( type == 'create'){
                evnt.description = d3.select('#dialogueBox #evntDescription').node().value;
                evnt.flexibility =  d3.select('#dialogueBox #evntFlexibility').node().value;
                evnt.start =  new Date( d3.select('#dialogueBox #evntStart').node().value); 
                evnt.duration_seconds = d3.select('#dialogueBox #evntDuration').node().value;
                evnt.consumption =  d3.select('#dialogueBox #evntConsumption').node().value;
                evnt.type = d3.select('#dialogueBox #iconField img.selected').node().alt;                
            }else{
                evnt.description = d3.select('#dialogueBox #evntDescription').node().value;
                evnt.flexibility =  d3.select('#dialogueBox #evntFlexibility').node().value;
                evnt.type = d3.select('#dialogueBox #iconField img.selected').node().alt;
                evnt.id = d3.select('#dialogueBox #evntId').node().value;
            }

            return evnt;
        }

        function validate_form(){
            // if (d3.select('#evntType').node().value === 'undefined') {
            if (d3.selectAll('#iconField .icon.selected').nodes().length == 0){
                return "ERROR: Please choose an icon before pressing OK.";
            }else{
                return '';
            }
        };

        sanitize = function (event) {
            if (event.description === undefined) {
                event.description = '';
            }
            if (event.event_type_id === undefined) {
                event.type = '';
            }
            return event;
        };

        function populateDialogBox(evnt){
            // event = sanitize(evnt);
            event = evnt;

            printDate = d3.timeFormat('%b %d %H:%M');

            durationInHours = Math.floor(+evnt.duration_seconds / 60000 / 60);
            durationInMinutes = (+evnt.duration_seconds/60000) % 60;
            durationLabel = durationInHours.toFixed(0) + " hours and "+ durationInMinutes.toFixed(0) +" minutes";

            d3.select('#dialogueBox #evntDurationLabel').html(durationLabel);
            d3.select('#dialogueBox #evntStartLabel').html(printDate( new Date(evnt.start)));
            d3.select('#dialogueBox #evntConsumptionLabel').html( (+evnt.consumption).toFixed(1)+" KW");

            d3.select("#iconField").empty();
            d3.select("#iconField")
                .selectAll('img')
                .data(event_types)
                .join('img')
                .attr('class', d => { return 'icon ' + d})
                .attr('value', d => {return d})
                .attr('src', d => { return '/static/imgs/event_icons/' + d + '.png'})
                .attr('alt', d => {return d})          
                .attr('title', d => {return d})
                .on('click', d => {
                   evnt.type = d.target['__data__'];
                   d3.selectAll('#iconField img').classed('selected',false)
                   d3.select('.'+evnt.type).classed('selected',true)
                })

            if(evnt.type) { d3.select('#iconField img.'+evnt.type).classed('selected',true) }

            d3.select('#dialogueBox #evntFlexibility').node().value = evnt.flexibility;
            d3.select('#dialogueBox #evntDescription').node().value = evnt.description;

            d3.select('#dialogueBox #evntStart').node().value = evnt.start;
            d3.select('#dialogueBox #evntDuration').node().value = evnt.duration_seconds;
            d3.select('#dialogueBox #evntConsumption').node().value = evnt.consumption;
            d3.select('#dialogueBox #evntType').node().value = evnt.type;
            // d3.select('#dialogueBox #evntCreated').node().value = evnt.createdAt;
            // d3.select('#dialogueBox #evntUpdated').node().value = -1;
            d3.select('#dialogueBox #evntId').node().value = evnt.id;
        }

        show_event_dialog = function(event){
            resetTimeOfInactivity();

            d3.select("#dialogueBox")
              .style('left', () => { return (window.innerWidth/2 - 250 )+ "px";})
              .style('display','block');

            populateDialogBox(event);

            d3.select('#submitEventBtn').on('click',null);
            d3.select('#submitEventBtn').on('click', (r) =>{
                console.log('SUMBITING EVENT')  

                errormessage = validate_form();
                if (errormessage !== '') {
                    // alert(errormessage);
                    d3.select('#infoBoxDialogue').html('Please choose an event type.')
                                        .style('display','block')
                    return;                       
                }

                if( d3.select('#dialogueBox').attr('isCreate') == 'true'){
                   console.log('CREATE EVENT')  
                  
                    createNewAnnotation();
                    async function createNewAnnotation()
                    {
                        // If new Push this event to a list of all
                        let event = getDialogueValues('create')
                        let eventSanitized = {
                                'start': event.start.toISOString(),
                                'duration_seconds':+event.duration_seconds,
                                'type': event.type,
                                'description':event.description,
                                'consumption':event.consumption,
                                'flexibility':event.flexibility,
                                'sensor': '100', 
                                'measurement': 'electricity_consumption'
                            }
                        try{
                            let result  = await d3.json('/annotations', {
                                method: 'PUT', 
                                headers: { "Content-Type": "application/json; charset=UTF-8" },
                                'body': JSON.stringify(eventSanitized)
                            });
                            
                            eventSanitized.id = result.lastInsertRowid;

                            allEvents.push(eventSanitized);
                            addAnnotationBar(event,eventSanitized.id);
                        }catch(e){
                            console.log(e);
                        }
                    }
                }else{
                 console.log('EDIT EVENT')  
                        
                    editAnnotation();

                    async function editAnnotation(){

                        let event = getDialogueValues('edit');
                        let eventSanitized = {
                                'flexibility':event.flexibility,
                                'type': event.type,
                                'description':event.description,
                            }

                        result  = await d3.json(`/annotations/${event.id}`, {
                            method: 'POST', 
                            headers: { "Content-Type": "application/json; charset=UTF-8" },
                            'body': JSON.stringify(eventSanitized)
                        });

                        // Update the local events
                        let index = 0;
                        for(i=0;i<allEvents.length;i++){
                            if( allEvents[i].id == event.id ){
                                index = i;
                                break;
                            }
                        }
                        allEvents[index].type = event.type;
                        allEvents[index].description = event.description;
                        allEvents[index].flexibility = event.flexibility;

                        // Update the visuals
                        editAnnotationBar(eventSanitized,event.id);                 
                    }
                }

                // Highlight the annotated area
                d3.selectAll('.dataPoints rect').filter( d => { 
                    // console.log(event.start.getTime() + event.duration)
                    return d.time >= event.start && d.time <= (event.start.getTime() + (+event.duration_seconds));
                })
                .classed('annottated',true)

                // Reset and close the dialogue
                resetDialogue();
                closeDialogue();
            });

            d3.select('#deleteEventBtn').on('click',null);
            d3.select('#deleteEventBtn').on('click', (r) =>{
                
                let id = d3.select('#dialogueBox #evntId').node().value;

                deleteAnnotation(id);
                
                async function deleteAnnotation(id){
                    try{
                        result  = await d3.json(`/annotations/${id}`, {
                            method: 'DELETE'
                        });
                       
                        // Delete from local events
                        let index = 0;
                        for(i=0;i<allEvents.length;i++){
                            if( allEvents[i].id == id ){
                                index = i;
                                break;
                            }
                        }

                        let tmpEvntStart = new Date(allEvents[index].start);

                        // De-Highlight the annotated area
                        d3.selectAll('.dataPoints rect').filter( d => { 
                            // console.log(event.start.getTime() + event.duration)
                            return d.time >= tmpEvntStart && d.time <= (tmpEvntStart.getTime() + (+allEvents[index].duration_seconds));
                        })
                        .classed('annottated',false)

                        deleteAnnotationBar(id);
                        allEvents.splice(index, 1)

                    }catch(e){
                        console.log(e)
                    }

                    // Reset and close the dialogue
                }

                resetDialogue();
                closeDialogue();

            });
        }

        function closeDialogue() {
            d3.select("#dialogueBox")
              .style('display','none');

            clearBrushSelection();
            brushContainer.call(brush.move,null);
            FLAG = false;
        }

        d3.select('#closebtnDialogue').on('click', closeDialogue);
    }

    function deleteAnnotationBar(id){
       dd = d3.selectAll(".annotationBar").filter(d => { return (d.id == id) })
       dd.remove();    
    }

    function editAnnotationBar(event, id){
        // console.log(event)

        dd = d3.selectAll(".annotationBar").filter(d => { return (d.id == id) })
        dd.data(event);
        dd.select('image').attr("xlink:href", (d) => { return '/static/imgs/event_icons/' + d.type + '_black.png'})
        dd.select('text').text((d) => { return d.type; })
    }

    function editEvent(e, evnt){
        if (!e.srcElement) return;
        console.log('edit event')

        d3.select('#dialogueBox h4').html('Edit event')
        d3.select('#dialogueBox').attr('isCreate','false')

        let localEvent = allEvents.filter(d => { return (d.id == evnt.id) })[0]

        show_event_dialog(localEvent)
    }

    function addAnnotationBar(event,id){

        const anntLine = d3.line()
                     .x(d => (d))
                     .y(svgHeight- svgMarginBottom + 10)

        event.id = id;

        tmpDate = new Date(event.start);

        anntContainer = d3.select("div#container svg")
          .append('g').attr('class','annotationBar')
          .datum(event)
          .attr('transform','translate('+xScale(tmpDate)+',0)')
          .on('click', (e,d) => {
                editEvent(e,d)})

        // TODO Make more elegant
        event.end = new Date( tmpDate.getTime() + (+event.duration_seconds));
        
        anntContainer
            .append('path')
            .datum([0,(xScale(event.end)-xScale(tmpDate))])
            .attr('d', anntLine) 
            .attr('stroke-width','2px')

        anntContainer
            .append('text')
            .attr('font-size','15px')
            .attr('x', 26)
            // .attr('y',svgMarginTop-35)
            .attr('y',svgHeight - svgMarginBottom +30)
            .text(event.type)

        anntContainer
            .append('image')
            .attr("xlink:href", '/static/imgs/event_icons/' + event.type + '_black.png')
            .attr("x", 0 )
            .attr("y", svgHeight - svgMarginBottom +15)
            // .attr("y", svgMarginTop-50)
            .attr("width", 20).attr("height", 20)

        blockC = anntContainer
                 .append('g').attr('class','blocksContainer')

        const amnt = (event.consumption/consumptionUnit).toFixed(0)
        array = [];
        for (var i = 0; i <amnt; i++) {
            array.push(1);
        }

        blockC.append('text').text( (+event.consumption).toFixed(2)+"KW")
              .attr('x', 0)//xScale(event.start))
              .attr('y',svgHeight - svgMarginBottom +50)

        y = -1;j=-1;

        linesize = (xScale(event.end)-xScale(tmpDate));
        blockC.selectAll('rect')
              .data(array, d => {return d})
              .join('rect')
              .attr('width',10)
              .attr('height',10)
              .attr('transform', (d,i) => { 

                if( j*15 > linesize){ y++;j=0;}
                else{ j++; }
                // x = xScale(new Date(event.start)) + j*20;
                return 'translate('+(j*15)+','+(y*15+svgHeight - svgMarginBottom +70)+')';
              })
              .style('fill','#ff9620');

        setAnnotationBarVisibility();
    }

    function setAnnotationBarVisibility(){
        // Hide text in day view, hide everything in week view
        if( WINDOW == 24){
            d3.selectAll('.annotationBar text').style('opacity',0)
            d3.selectAll('.annotationBar image').style('opacity',1)
            d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)

        }else if(WINDOW == 24*7){
            d3.selectAll('.annotationBar text').style('opacity',0)
            d3.selectAll('.annotationBar image').style('opacity',0)
            d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)
        }else{
           d3.selectAll('.annotationBar text').style('opacity',1)
           d3.selectAll('.annotationBar image').style('opacity',1)
           d3.selectAll('.annotationBar .blocksContainer').style('opacity',1)
        }
    }

    function updateAnnotationBar(){
        
        d3.selectAll('.annotationBar')
         .transition()
         .attr('transform', d => {
            ff = allEvents.filter( e => {
               return e.id == d.id;
            })[0];
            tmpDate = new Date(ff.start);
            return 'translate('+xScale(tmpDate)+',0)';
        })

        d3.selectAll('.annotationBar').each( (d,i) =>{

            tmpDate = new Date(d.start);
            end = new Date( tmpDate.getTime() + (+d.duration_seconds));

            const anntLine = d3.line()
             .x(d => (d))
             .y(svgHeight- svgMarginBottom + 10)
           
           // TODO Make more elegant
            parentNode = d3.selectAll('.annotationBar').nodes()[i];
            d3.select(parentNode).select('path')
                .datum([0,(xScale(end)-xScale(tmpDate))])
                .attr('d', anntLine) 

        })

        setAnnotationBarVisibility();
    }

    function updateXAxis(){
            xAxis = d3.axisTop()
                .ticks(15)
                .tickSize(-svgHeight+svgMarginBottom)
                .tickFormat(d3.timeFormat('%b %d %H:%M'))
                .scale(xScale);

            d3.select(".x-axis")
                    .transition()
                    .call(xAxis)
                    .selectAll("text")  
                    .style("text-anchor", "start")
                    .attr("dx", ".8em")
                    .attr("dy", "-.5em")
                    .attr('y',0)
                    .attr("transform", "rotate(-45)");
    }
    
    d3.select('#saveCSVElectricity').on('click', exportCSVElectricity);
    d3.select('#saveCSVAnnotation').on('click', exportCSVAnnotation);

    async function exportCSVAnnotation(){
        resetTimeOfInactivity();

        let csvContent = "data:text/csv;charset=utf-8," 
        
        result = await d3.json('/annotations');

        // save label names
        pp = '';
        for (const key in result[0]) {
            pp += key + ',';
        }
        pp = pp.slice(0, -1); 
        csvContent += pp + "\n";

        // save data 
        result.forEach( (e,i) => {
            pp = '';
            for (const key in e) {
                    pp += e[key] + ',';
            }
            pp = pp.slice(0, -1);
            csvContent += pp + "\n";
        });
        
        //https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "my_data.csv");
        document.body.appendChild(link); // Required for FF

        link.click(); // This will download the data file named "my_data.csv".
    }  

    async function exportCSVElectricity(){
        resetTimeOfInactivity();

        console.log('button#download-button');
        const sensor_id = sensorId;
        const measurement = 'electricity_consumption';
        const url = `/measurement/${measurement}/sensor/${sensor_id}/rawdata/`;
        const now = luxon.DateTime.now();
        const today = new luxon.DateTime(now.year, now.month, now.day);
        const start = today.minus({weeks: 5});
        const total_days = luxon.Interval.fromDateTimes(start, today).length('days');
        let all_data = [];
        for (let d=0; d<total_days; d+=1) {
            const curr = start.plus({'days': d});
            const next = curr.plus({'days': 1});
            console.log(`d: ${d}, curr: ${curr.toFormat('yyyy-LL-dd')}, next: ${next.toFormat('yyyy-LL-dd')}`);
            const query = `?start=${curr.toFormat('yyyy-LL-dd')}&end=${next.toFormat('yyyy-LL-dd')}`;
            const response = await d3.json(url+query);
            console.log('response:', response);
            all_data = all_data.concat(response.readings);
        }
        console.log('all_data:', all_data);

        let csv_content = "data:text/csv;charset=utf-8,";

        all_data.forEach(function(row) {
            csv_content += `${row.time},${row.value}` + "\r\n";
        });        

        const encoded_uri = encodeURI(csv_content);
        var link = document.createElement("a");
        link.setAttribute("href", encoded_uri);
        link.setAttribute("download", `${measurement}_${sensor_id}.csv`);
        document.body.appendChild(link); // Required for FF
        
        link.click(); // This will download the data file named "my_data.csv".        
    };

    function getSunriseSunset(data){
        d3.json('https://api.sunrise-sunset.org/json?lat=51.509865&lng=-0.118092&date=today&formatted=0')
          .then(function (sun) {
            // console.log(data);

            d3.select('div#container svg')
              .append('g').lower()
              .attr('class','backgroundData')
              .attr("clip-path", "url(#clip)");

            sunset = new Date(sun.results.sunset);
            sunrise = new Date(sun.results.sunrise);
             
            drawSunriseSunset(data);
        });
    } 

    function updateSunriseSunset(){
        lengthOfNight = (24 - sunset.getHours()) + sunrise.getHours();

        d3.select('.backgroundData').selectAll('rect')
            .transition()
            .attr('x', d => { return xScale(d.time)})
            .attr('width', d => { 
                tmp = new Date(xScale.domain()[0]);
                tmp2 = new Date(tmp);
                tmp2.setHours(tmp2.getHours() + lengthOfNight);
                return (xScale(tmp2)- xScale(tmp)); 
            })

        d3.select('.backgroundData').selectAll('text')
            .transition()
            .attr('x', d => { return xScale(d.time) +20})
    }

    function drawSunriseSunset(data){

        d3.selectAll('.backgroundData rect').remove()
        d3.selectAll('.backgroundData text').remove()
        let nights = [];

        if(data.length > 0 ){
            counter = data[0].time.getDate();
            nights = data.filter(d => {
                if((d.time.getHours() == sunset.getHours() && d.time.getDate() == counter)){
                    counter++;
                    return true ;
                }
            })
        }

        lengthOfNight = (24 - sunset.getHours()) + sunrise.getHours();

        d3.select('.backgroundData').selectAll('rect')
            .data(nights)
            .join('rect')
            .attr('x', d => { return xScale(d.time)})
            .attr('y',0)
            .attr('width', d => { 
                tmp = new Date(xScale.domain()[0]);
                tmp2 = new Date(tmp);
                tmp2.setHours(tmp2.getHours() + lengthOfNight);
                return (xScale(tmp2)- xScale(tmp)); 
            })
            .attr('height', svgHeight- svgMarginBottom )
            .style('opacity',0.1)
             .style('fill','gray')

            d3.select('.backgroundData').selectAll('text')
              .data(nights)
              .join('text')
              .text('night')
              .attr('x', d => { return xScale(d.time)+10})
              .attr('y', 60)
              .style('font-style','italic')
              .style('font-size','14px')
              .attr('fill','gray')
   }

});