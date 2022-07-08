document.addEventListener("DOMContentLoaded", function() { 
    
    const urlParams = new URLSearchParams(window.location.search);
    const paramMeasurement = urlParams.get('measurement') ;
    const paramSensorid = urlParams.get('sensor');

    let startMinutes = 24*60;
    let endMinutes = 0;

    let data = {};
    let allEvents = [];

    let svgWidth = window.innerWidth //+200; //> 700 ? 700:window.innerWidth ;
    let svgHeight = window.innerHeight //svgWidth / 2 > window.innerHeight - 350? window.innerHeight -350:svgWidth / 2;
    
    /*Check if mobile/portrait mode*/
    if( svgWidth < svgHeight){
        svgHeight = svgWidth;
    }


    const margin = 5;
    const padding = 5;
    const adj = 30;
    const svgMarginTop = 30;
    const svgMarginBottom = window.innerHeight > 530 ? 300:200;
    const svgMarginLeft = 0;

    let sensorId = 96;
    let xScale, yScale, brush;
    let drawSolarGeneration = undefined;
    let loadData = undefined;

    event_types = ['washing_and_drying','housework','dishwasher','kettle','microwave','oven',
                    'question_mark','toaster','air_cooling','heating','showering_and_hair-drying',
                    'computer','hob','ironing','lighting','meal_breakfast','meal_lunch','meal_dinner',
                    'watching_tv', 'special_event', 'other'
                   ];

    let SHIFT_BY =  8// 4 // // ; // 30min CHECK
    let WINDOW = 12// 8 //  //  // 30min CHECK
    let FLAG = false;
    let SCALING_FACTOR = 0.23;

    let timeOfInactivity = 60000;
    let sunrise, sunset, solarData;
    const consumptionUnit = 0.1;

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

    // from https://stackoverflow.com/a/1026087/6872193
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
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
        //     .text(name.replace('_',' '));

        svgContainer
            .append("svg")
            .attr('id', measurement.id + 'Chart')
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "-"
                + 1.5 * adj + " -"
                + 2.5*adj + " "
                + (svgWidth + adj*3) + " "
                + (svgHeight + adj*4))
            .style("padding", padding)
            .style("margin", margin)
            .classed("svg-content", true);
    }

    const loadMeasurementData = function (series) {
        const measurement = series.measurement;
        const sensor_id = series.sensor_id;
        sensorId = series.sensor_id;

        // check points 
        let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-${startMinutes}&showAll=true&points=80`;
        if (endMinutes > 0) {
            dataUrl = dataUrl + `&end=-${endMinutes}`;
        }

        return d3.json(dataUrl).then(function (response) {
            console.log(response)
            drawGraphs(response,sensor_id,series);
            drawSolarGeneration();
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

        data = data.map(function (d) {
            let v = +d.value*SCALING_FACTOR + offset;
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

    function drawGraphs (response,sensor_id,series){

        let newdata = formatData(response.readings);

        let freshData = false;

        if(!data[series.id]){
            console.log('Fresh data. Creating data['+series.id+']');
            freshData = true; 
            data[series.id] = [];
        }

        data[series.id] = data[series.id].concat(newdata);

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
            max = new Date(max.getTime() + 30*60*1000); // add 30min so as to see the laterst 

            if(freshData == false) { 
               max = new Date(max.getTime() + WINDOW*60*60*1000); 
            };
            min = new Date(max);
            min.setHours(max.getHours() - WINDOW)
        }

        xScale = d3.scaleTime(
            // d3.extent(data, d => new Date(d.time.getTime())),
            [ min , max ],
            [0, svgWidth-svgMarginLeft]
        );

        yScale = d3.scaleLinear(
            [0, 2.5],
            // [(0), 1.1 * d3.max(data[series.id], d => +d.value)],
            [svgHeight-svgMarginBottom, svgMarginTop]
        );
        
        solarLine = d3.area()
                     .x(d => xScale(d.datetime))
                     .y1(d => yScale(d.P_GEN_RA))
                     .y0(svgHeight -svgMarginBottom)


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
        svg.selectAll('.backgroundData').remove();
        svg.selectAll('.annotations').remove();
        svg.selectAll('.brush').remove();
        svg.selectAll('#clip').remove();

        svg.append("g")
            .attr("class", "axis x-axis top")
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
                .text('Power'+' (kW)');
                // .text(label.replace('_',' ')+' (KW)');
        
        svg.append('clipPath')
              .attr("id", "clip")
              .append('rect')
              .attr('x',xScale.range()[0])
              .attr('y',yScale.range()[1])
              .attr('width',xScale.range()[1]-xScale.range()[0])
              .attr('height',yScale.range()[0]-yScale.range()[1] + svgMarginBottom)


        // Pattern from https://svg-stripe-generator.web.app/
        svg.append('defs').html(`
            <pattern id="stripe-pattern" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <line x1="0" y="0" x2="0" y2="7" stroke="#FAEBD7" stroke-width="10" />
        </pattern>`)
//      <line x1="0" y="0" x2="0" y2="11.5" stroke="#194d33" stroke-width="0.5" />

        svg.append('g').attr('class','annotations').attr("clip-path", "url(#clip)")

        // Add clipping path for making the animation look better
        // But make sure it doesnt exist first.
        if(svg.select('.dataPoints').node() === null ){
            svgGroup = svg.append("g").attr("class","dataPoints")
                            .attr("clip-path", "url(#clip)");
        }

        updateGraph = function (dataF, firstCall,id){
            
            if(id) {
                svg = d3.select('svg#' + id + 'Chart');
            }else{
                svg = d3.select('svg#' + series.id + 'Chart');
            }

            svg.select('.dataPoints').selectAll('rect')
                .data(dataF)
                .join("rect")
                .attr("width", () => {
                    if( WINDOW == 24){ return 30; }
                    else if (WINDOW == 24*7){ return 1;} 
                    else{  return (svgWidth- svgMarginLeft )/24}//53; } // 30min CHECK
                    // else{ return 6; }

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
                svg.select('.dataPoints')
                    .selectAll('rect')
                    .transition()
                    .attr("x", d => { 
                        return xScale(new Date(d.time.getTime())); 
                    })
            }else{
                svg.select('.dataPoints')
                  .selectAll('rect')
                  .attr("x", d => { 
                    return xScale(new Date(d.time.getTime())); 
                  })
            }
        
            svg.select('.dataPoints')
               .selectAll('rect.annottated')
               .style('fill','steelblue')
        }

        addBrushing = function (){
            brush = d3.brushX()
                            .extent([[0,svgMarginTop], [svgWidth+20, svgHeight-svgMarginBottom]])
                            .on('start', brushStart)
                            .on('end', brushEnd)
                            .on('brush', brushing)

            // svg = d3.select('svg#' + series.id + 'Chart');
            
            let brushContainer = svg.append("g")
                                    .attr('class','brush')
                                    .call(brush)

            function brushStart({selection}) {
                if(WINDOW == 24*7) { return }
                resetTimeOfInactivity();

                // console.log('brush started');
                svg.select('.saveBtnContainer').remove();
                
                // TODO MAKE GENERAL
                d3.select('#infoBox').html('').style('display','none');
                
                // svg.selectAll('.dataPoints rect').style("opacity", 0.2)// d => { 
                    // return sx[0] <= d.time && d.time < sx[1] ? "1" : '0.2'; });
                    // d3.select(this).call(brushHandle, selection);


            }

            function brushEnd(event) {
                resetTimeOfInactivity();
                if (!event.sourceEvent) return;
                console.log('brush ended');

                // const d0 = event.selection.map(xScale.invert);
                // const d1 = d0.map(interval.round);

                selection = event.selection;

                allEvents.sort( (a,b) => { return new Date(b.start) - new Date(a.start); })

                // check it was not a random click
                if( selection && selection.length >= 2){

                    interval = d3.timeMinute.every(30) // 2// check for 30min
    
                    let sx0 = selection.map(xScale.invert);
                    let sx = sx0.map(interval.round);

                    // If empty when rounded, use floor instead.
                    if (sx[0] >= sx[1]) {
                      sx[0] = interval.floor(sx0[0]);
                      sx[1] = interval.offset(sx[0]);
                    }

                    d3.select(this).call(brush.move, sx.map(xScale));
                    // d3.select(this).call(brushHandle, sx.map(xScale));

                    // Check if any of the brush is inside an existing annotation. If so 
                    // return.
                    for (const e of allEvents){
                        tmpStart = new Date(e.start);
                        tmpEnd = new Date(tmpStart.getTime() + (+e.duration_seconds));

                        if ( (sx[0] < tmpEnd && sx[0]>= tmpStart) ||
                             (sx[1] <= tmpEnd && sx[1]> tmpStart)){
                            clearBrushSelection();
                            brushContainer.call(brush.move,null);
                            d3.select('#infoBox').html('You cannot have overlapping annotations').style('display','block');
                            return;
                        }
                    }

                  svg.selectAll('.dataPoints rect').style("opacity", d => { 
                    return sx[0] <= d.time && d.time < sx[1] ? "1" : '0.2'; });

                    // Create a button to save event
                    svg.append('g')
                      .attr('class','saveBtnContainer')
                      .style('cursor','pointer')
                      .on('click', () => { createEvent(sx); })
                      // Show the save button aligned to the selection
                      .attr('transform', 'translate(' +(xScale(sx[0]) + (xScale(sx[1])-xScale(sx[0]))/2 - 50)+','+(svgMarginTop)+')')
                    
                    svg.select('.saveBtnContainer')
                        .append('rect')
                        .attr('id','saveButton')
                        .attr('width',100)
                        .attr('height',30)
                        .attr('rx',15)
                    svg.select('.saveBtnContainer')
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
               if (!event.sourceEvent) return;
               // console.log('brush hapenning')
                resetTimeOfInactivity();

                FLAG = true;

                if (selection === null) {
                   clearBrushSelection();
                } else {
                    // const sx = selection.map(xScale.invert);
                    interval = d3.timeMinute.every(30)
    
                    let sx0 = selection.map(xScale.invert);
                    let sx = sx0.map(interval.round);

                    // If empty when rounded, use floor instead.
                    if (sx[0] >= sx[1]) {
                      sx[0] = interval.floor(sx0[0]);
                      sx[1] = interval.offset(sx[0]);
                    }

                  svg.selectAll('.dataPoints rect').style("opacity", d => { 
                    return sx[0] <= d.time && d.time <= sx[1] ? "1" : '0.2'; });

                    // d3.select(this).call(brushHandle, selection );
                }

                // d3.select(this).call(brush.move, sx.map(xScale));
            }

            // arc = d3.arc()
            //     .innerRadius(0)
            //     .outerRadius((svgHeight - svgMarginBottom - svgMarginTop ) / 2)
            //     .startAngle(0)
            //     .endAngle((d, i) => i ? Math.PI : -Math.PI)

            // brushHandle = (g, selection) => g
            //   .selectAll(".handle--custom")
            //   .data([{type: "w"}, {type: "e"}])
            //   .join(
            //     enter => enter.append("path")
            //         .attr("class", "handle--custom")
            //         .attr("fill", "#666")
            //         .attr("fill-opacity", 0.8)
            //         .attr("stroke", "#000")
            //         .attr("stroke-width", 1.5)
            //         .attr("cursor", "ew-resize")
            //         .attr("d", arc)
            //   )
            //     .attr("display", selection === null ? "none" : null)
            //     .attr("transform", selection === null ? null : (d, i) => `translate(${selection[i]},${(svgHeight - svgMarginBottom - svgMarginTop) / 2})`)



            function createEvent(selection){
                let evnt = {};

                // TODO MAKE GENERAL
                d3.select('#dialogueBox h4').html('Create Event')
                d3.select('#dialogueBox').attr('isCreate','true')

                evnt.series = series.id;

                evnt.flexibility = ''
                evnt.description = ''

                // TODO: add more acccurate time mapping based on the bars not the brushing

                evnt.start = selection[0]; 
                evnt.end = selection[1];

                evnt.duration_seconds = evnt.end.getTime() - evnt.start.getTime();

                const event_readings = data[series.id].filter(d => {
                    return (new Date(d.time)).getTime() >= evnt.start.getTime() && (new Date(d.time)).getTime() < evnt.end.getTime();
                });

                console.log(event_readings);

                // evnt.duration_seconds = d3.max(event_readings, d => d.time).getTime() - d3.min(event_readings, d => d.time).getTime();

                // TODO: add always on function
                evnt.consumption = (30/60)*d3.sum(event_readings, d => d.value); //  (2/60) SAMPLING_INTERVAL CHECK 30min
                // evnt.consumption = d3.sum(event_readings, d => d.value);
                // evnt.consumption = ((SAMPLING_INTERVAL)/60) * d3.sum(event_readings, d => d.value); // - always_on;
                                //  / number of samples (lenth of array) * (duration_minutes/60) 

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
                d3.select('#dialogueBox #evntConsumptionLabel').html( (+evnt.consumption).toFixed(2)+" kWh");

                d3.select("#iconField").empty();
                d3.select("#iconField")
                    .selectAll('img')
                    .data(event_types)
                    .join('img')
                    .attr('class', d => { return 'icon ' + d})
                    .attr('value', d => {return d})
                    .attr('src', d => { return '/static/imgs/event_icons/' + d + '.svg'})
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
                  .style('left', () => { return (window.innerWidth/2 - 580/2 )+ "px";})
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
                                    'sensor': series.sensor_id, // sensor_id
                                    'measurement': series.measurement //'electricity_consumption'
                                }
                            try{
                                d3.select('#spinner').style('display','block');

                                let result = await d3.json('/annotations', {
                                    method: 'PUT', 
                                    headers: { "Content-Type": "application/json; charset=UTF-8" },
                                    'body': JSON.stringify(eventSanitized)
                                });
                                
                                eventSanitized.id = result.lastInsertRowid;

                                allEvents.push(eventSanitized);
                                addAnnotationBar(event,eventSanitized.id, series.id);
                                d3.select('#spinner').style('display','none')
                            }catch(e){
                                console.log(e);
                                d3.select('#spinner').style('display','none');
                                d3.select('#spinner').html(e);
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

                            try{

                                d3.select('#spinner').style('display','block');

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
                                d3.select('#spinner').style('display','none')
                            }catch(e){
                                console.log(e);
                                d3.select('#spinner').style('display','none');
                                d3.select('#spinner').html(e);
                            }               
                        }
                    }

                    // Highlight the annotated area
                    d3.selectAll('.dataPoints rect').filter( d => { 
                        // console.log(event.start.getTime() + event.duration)
                        return d.time >= event.start && d.time < (event.start.getTime() + (+event.duration_seconds));
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

                            d3.select('#spinner').style('display','block');
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
                                return d.time >= tmpEvntStart && d.time <= (tmpEvntStart.getTime() + (+allEvents[index].duration_seconds));
                            })
                            .classed('annottated',false)
                            .style('fill', 'rgba(100,100,100,1)')

                            deleteAnnotationBar(id);
                            allEvents.splice(index, 1)
                            d3.select('#spinner').style('display','none')
                        }catch(e){
                            console.log(e)
                            d3.select('#spinner').style('display','none')
                            d3.select('#infoBox').html(e);
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


            function clearBrushSelection(){
                svg.select('.saveBtnContainer').remove();
                svg.selectAll('.dataPoints rect').style("opacity", '1');
            }
        }

        drawSolarGeneration = async function(){

            if(solarData=== undefined){
                today = new Date();
                dayCounter = 0;
                try{ 
                   solarData = await d3.csv('/static/data/solar_generation_patterndata.csv')

                   let dtmp = new Date(today);
                    solarData.forEach( tt =>{
                       if(tt['t_time'] == '00:01:00'){
                            dtmp.setDate(today.getDate() - dayCounter)
                            // /today.getTime() - counter*24*60*60*1000
                            dayCounter++;
                       }
                       tt['datetime'] = new Date(today);
                       tt['datetime'].setDate(dtmp.getDate())
                       tt['datetime'].setMonth(dtmp.getMonth())
                       tt['datetime'].setHours(tt['t_h'])
                       tt['datetime'].setMinutes(tt['t_m'])
                    })
                    svg.append('path')
                    .attr('id','solarData')
                    .datum(solarData)

                    svg.append('rect').attr('x',40).attr('y',30).attr('width',30).attr('height',30)
                                    .style('fill',"white")
                    svg.append('rect').attr('x',40).attr('y',30).attr('width',30).attr('height',30)
                                    .style('fill',"url('#stripe-pattern')")
                                    .style('stroke','#40405063')

                    svg.append('text').attr('x',75).attr('y',40).text('Example solar curve ').style('fill','#555').style('font-size','10px')
                    svg.append('text').attr('x',75).attr('y',50).text(' on a sunny day').style('fill','#555').style('font-size','10px')

                }catch(e){
                    console.log(e)
                }
            }

            // console.log(solarData)
            svg.select('#solarData')
                .attr('d',solarLine)
                .style('opacity','0.6')
                .style('fill',"url('#stripe-pattern')")
                .style('stroke','#40405063')
                .attr("clip-path", "url(#clip)");

            d3.select('.dataPoints').raise()
            d3.select('.brush').raise()
        }

        updateGraph(data[series.id],true);
        getSunriseSunset(data[series.id],series.id);
        updateSolarGeneration();
        drawAnnotations(series.id);
        addBrushing();
    }
    
    d3.select('#btnEarlier').on('click', getEarlierData);

    d3.select('#btnRecent').on('click', e => {

        resetTimeOfInactivity();

        tmp = xScale.domain();
        maxTime = new Date();
        maxTime = new Date(max.getTime()+30*60*1000);        
        minTime = maxTime - WINDOW * 60 * 60 *1000;
        // new Date(tmp[0].setHours(tmp[0].getHours()-SHIFT_BY));
        // minTime.setHours(maxTime.getHours()+WINDOW);

        xScale = d3.scaleTime(
            [minTime , maxTime],
            [0, svgWidth-svgMarginLeft]
        );

        updateXAxis();
        allSensorIds = Object.keys(data);            
        allSensorIds.forEach( h => { updateGraph(data[h],false,h); });
        updateSunriseSunset();
        updateAnnotationBar();
        updateSolarGeneration();
    });
    
    d3.select('#btnLater').on('click', e =>{
        resetTimeOfInactivity()

        tmp = xScale.domain()
        minTime = new Date(tmp[0].setHours(tmp[0].getHours()+SHIFT_BY));
        maxTime = new Date(minTime);
        maxTime.setHours(maxTime.getHours()+WINDOW);

        // hardMaximum = minTime + WINDOW/2 * 60 * 60 * 1000
        allSensorIds = Object.keys(data);            
        if( maxTime > d3.max(data[allSensorIds[0]], d =>{ return d.time }) ){
            d3.select('#btnLater').classed('disabled',true)
            return;
        }

        d3.select('#btnEarlier').classed('disabled',false)
        
        xScale = d3.scaleTime(
            [minTime , maxTime],
            [0, svgWidth-svgMarginLeft]
        );

        updateXAxis();
        allSensorIds.forEach( h => { updateGraph(data[h],false,h); });
        updateSunriseSunset();
        updateAnnotationBar();
        updateSolarGeneration();
    });

    d3.select('#btnScale24').on('click', e =>{
        WINDOW = 24;
        SHIFT_BY = 12;
        resetTimeOfInactivity();

        d3.selectAll('.scaleBtn').classed('selected',false)
        d3.select('#btnScale24').classed('selected',true)

        d3.select('#btnEarlier').classed('disabled',false)
        d3.select('#btnLater').classed('disabled',false)
        // clearBrushSelection();
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
        allSensorIds = Object.keys(data);            
        allSensorIds.forEach( h => { updateGraph(data[h],false,h); });
        updateAnnotationBar();
        updateSolarGeneration()
        updateSunriseSunset();
    });

    d3.select('#btnScale8').on('click', e =>{
        WINDOW = 12 // 8; //  //  30min CHECK
        SHIFT_BY = 8;// 4 /// 30min CHECK
        resetTimeOfInactivity();

        d3.selectAll('.scaleBtn').classed('selected',false)
        d3.select('#btnScale8').classed('selected',true)

        d3.select('#btnEarlier').classed('disabled',false)
        d3.select('#btnLater').classed('disabled',false)
        // clearBrushSelection();
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
        allSensorIds = Object.keys(data);            
        allSensorIds.forEach( h => { updateGraph(data[h],false,h); });
        updateAnnotationBar();
        updateSolarGeneration()
        updateSunriseSunset();
    });

/*    d3.select('#btnScaleWeek').on('click', e =>{
        WINDOW = 24*7;
        SHIFT_BY = 24*4;
        resetTimeOfInactivity();

        d3.selectAll('.scaleBtn').classed('selected',false)
        d3.select('#btnScaleWeek').classed('selected',true)
        // clearBrushSelection();
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
        allSensorIds = Object.keys(data);            
        allSensorIds.forEach( h => { updateGraph(data[h],false,h); });
        updateAnnotationBar();
        updateSunriseSunset();
    });
*/
    let seriesUrl = '/series/?showAll=true';

    d3.json(seriesUrl).then(function (allSeries) {
        console.log(allSeries)

        if( paramMeasurement && paramSensorid){
            toKeep = paramMeasurement;
        }else{
            toKeep = "electricity_consumption";
            // toKeep = "TVOC";
        }
        // toKeep = [
        //             "temperature",
        //             "humidity",
        //             "electricity_consumption",
        //             "TVOC",
        //          ];
        // toKeep = "electricity_consumption";
        // toKeep = "TVOC";

        // "&& d.sensor_id==100;" >> temporary FIX!!
        allSeries = allSeries.filter(function (d) {
            return toKeep.includes(d.measurement) // && (d.sensor_id <=96 && d.sensor_id >= 96);//d.sensor_id==2;
        });

        let allMeasurements = [...new Set(allSeries.map(d => d.measurement))];
        console.log(allMeasurements);
        let allSensors = [...new Set(allSeries.map(d => d.sensor_id))];

        allSeries = allSeries.map(function (item) {
                const id = `${item.measurement}_${item.sensor_id}`;
                let name = item.measurement;
                if (name in nameLUT) {
                    name = nameLUT[name];
                } 
                if (allSensors.length > 1) {
                    name = `${name} (sensor #${item.sensor_id})`;
                }
                name = capitalize(name);
                
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

        // Periodical refresh if FLAG is down
        function refreshData() {
            if(FLAG == false){
                window.location.reload();
            }
            // const promises = _series.map(m => refreshMeasurementData(m));
            // Promise.all(promises).then( () => {
            //     console.log('All refreshed');
            // });
        }

        async function refreshMeasurementData(m){
            const measurement = m.measurement;
            const sensor_id = m.sensor_id;
            // const measurement = 'electricity_consumption';
            // const sensor_id = sensorId;

            let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-2&showAll=true&points=80`;
            if(FLAG == false){
                try{
                    d3.select('#spinner').style('display','block');

                    result = await d3.json(dataUrl);
                    // console.log(result.readings);

                    formattedData = formatData(result.readings);
                    
                    let dd = [];
                    let sID = measurement+'_'+sensor_id;
                    // Checks that there are no duplicates pushed in the data
                    // Assumes the the data array is sorted!
                    formattedData.forEach( g => {
                        tmp = false;
                        for( i = data[sID].length-1; i>=0;i--){
                            if(g.time.getTime() > data[sID][i].time.getTime() && tmp==false ){
                                dd.push(g);
                                tmp = true;
                            }else if(data[sID][i].time.getTime() <= g.time.getTime()){
                               return;
                            } 
                        }
                    });

                    data[sID] = data[sID].concat(dd);

                    data[sID].sort((a,b)=> { return (new Date(a.start)) - (new Date(b.start));})
                    updateGraph(data[sID],false,sID);
                    resetTimeOfInactivity();
                    d3.select('#spinner').style('display','none')
                }catch(e){
                    console.log(e);
                    d3.select('#spinner').style('display','none')
                    d3.select('#infoBox').html(e);

                }
            }
        }

        startTimer();

        function startTimer() { 
            // window.setTimeout returns an Id that can be used to start and stop a timer
            timeoutId = window.setTimeout(refreshData, timeOfInactivity)
        }

        resetTimeOfInactivity = function (){
     
            window.clearTimeout(timeoutId)
            startTimer();

            timeOfInactivity = 6*60*1000;
        }

        d3.select('select#measurementSelect')
            .selectAll(null)
            .data(allMeasurements)
            .enter()
            .append('option')
                .attr('value', function (d) {return d; } )
                .html(function (d) { return d; });

        d3.select('select#sensorSelect')
            .selectAll(null)
            .data(allSensors)
            .enter()
            .append('option')
                .attr('value', function (d) {return d; } )
                .html(function (d) { return d; });

        let handle_select = function () {
            const measurement = d3.select('select#measurementSelect').node().value;
            const sensor_id = d3.select('select#sensorSelect').node().value;
            _series = allSeries.map(function (serie) {return serie;});
            if (measurement !== 'Any Measurement') {
                _series = _series.filter(function (serie) {return serie.measurement === measurement;});
            }
            if (sensor_id !== 'Any Sensor') {
                _series = _series.filter(function (serie) {return serie.sensor_id === sensor_id;});
            }

            d3.selectAll('#container svg').remove();
            d3.selectAll('#container h4').remove();

            // Go back to the begining
            startMinutes = 24*60;
            endMinutes = 0;

            loadData();
        };
        
        d3.select('select#measurementSelect').on('change', handle_select);
        d3.select('select#sensorSelect').on('change', handle_select);


    });

    function getEarlierData(e){
        resetTimeOfInactivity();

        tmp = xScale.domain();
        minTime = tmp[0] - SHIFT_BY * 60 * 60 *1000;
        // new Date(tmp[0].setHours(tmp[0].getHours()-SHIFT_BY));
        maxTime = new Date(minTime);
        maxTime.setHours(maxTime.getHours()+WINDOW);

        // Check if almost out of bounds
        allSensorIds = Object.keys(data);  
        console.log(allSensorIds[0])   
        console.log(data[allSensorIds[0]].length)       
        if( minTime - SHIFT_BY/2 * 60 * 60 *1000 <= d3.min(data[allSensorIds[0]], d =>{ return d.time }) ||
            data[allSensorIds[0]].length == 0
         ){
            // GET EARLIER DATA
            // move backwards in time based on the 'startMinutes' measure
            // the endMinutes is set so as to not requery existing data
            console.log("CALLING NEW DATA")
            endMinutes = startMinutes.valueOf();
            startMinutes += startMinutes;
            loadData();
        }else{
            xScale = d3.scaleTime(
                [minTime , maxTime],
                [0, svgWidth-svgMarginLeft]
            );
            
            updateXAxis();
            allSensorIds.forEach( h => { updateGraph(data[h],false,h); })
            updateSunriseSunset();
            updateAnnotationBar();
            updateSolarGeneration();
        }
        d3.select('#btnLater').classed('disabled',false)
        d3.select('#btnRecent').classed('disabled',false)
    };

    async function drawAnnotations(seriesId){
        try{
            d3.select('#spinner').style('display','block');

            result = await d3.json('/annotations');

            allEvents = result;
            allEvents.forEach( g => {

                tmpDate = new Date(g.start);

                // Highlight the annotated area
                // d3.select('#'+seriesId+'Chart')
                d3.select('#'+g.measurement+"_"+g.sensor+'Chart')
                  .selectAll('.dataPoints rect')
                  .filter( d => { 
                    return d.time >= tmpDate && d.time <(tmpDate.getTime() + (+g.duration_seconds));
                  })
                  .classed('annottated',true)

                addAnnotationBar(g, g.id, g.measurement+"_"+g.sensor);
            })
            console.log("DRAWING ANNOTATIONS")
            d3.select('#spinner').style('display','none')
        }catch(e){
            console.log("error " + e)
            d3.select('#spinner').style('display','none');
            d3.select('#spinner').html(e);
        }
    }

    function deleteAnnotationBar(id){
       dd = d3.selectAll(".annotationBar").filter(d => { return (d.id == id) })
       dd.remove();    
    }

    function editAnnotationBar(event, id){

        dd = d3.selectAll(".annotationBar").filter(d => { return (d.id == id) })
        dd.data(event);
        dd.select('image').attr("xlink:href", (d) => { return '/static/imgs/event_icons/' + d.type + '.svg'})
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

    function addAnnotationBar(event,id,seriesId){

        const anntLine = d3.line()
                     .x(d => (d))
                     .y(svgHeight- svgMarginBottom + 10)

        event.id = id;

        tmpDate = new Date(event.start);

        anntContainer = d3.select("div#container svg#"+seriesId+'Chart .annotations')
          .append('g').attr('class','annotationBar')
          .datum(event)
          .attr('transform','translate('+xScale(tmpDate)+',0)')

        // TODO Make more elegant
        event.end = new Date( tmpDate.getTime() + (+event.duration_seconds));
        linesize = (xScale(event.end)-xScale(tmpDate));

        anntContainer
            .append('path')
            .attr('class','topAnnotationLine')
            .datum([0,(xScale(event.end)-xScale(tmpDate))])
            .attr('d', anntLine) 
            .attr('stroke-width','2px')

        anntContainer.append('path')
                    .attr('class','leftAnnotationLine')
                    .attr('d', 'M 0,'+(svgHeight- svgMarginBottom + 10)+' L 0,'+(svgHeight))
                    .attr('stroke-width','0.5px')
                    .attr('stroke-dasharray','3')

        anntContainer.append('path')
                    .attr('class','rightAnnotationLine')
                    .attr('d', 'M '+(linesize)+','+(svgHeight- svgMarginBottom + 10)+' L'+(xScale(event.end)-xScale(tmpDate))+','+(svgHeight))
                    .attr('stroke-width','0.5px')
                    .attr('stroke-dasharray','3')

        // anntContainer
        //     .append('text')
        //     .attr('font-size','15px')
        //     .attr('x', 45)
        //     // .attr('y',svgMarginTop-35)
        //     .attr('y',25+svgHeight - svgMarginBottom +30)
        //     .text(event.type)

        anntContainer
            .append('image')
            .attr("xlink:href", '/static/imgs/event_icons/' + event.type + '.svg')
            .attr("x", linesize/2 - 20 )
            .attr("y", 23+svgHeight - svgMarginBottom +15)
            // .attr("y", svgMarginTop-50)
            .attr("width",40).attr("height", 40)

        blockC = anntContainer
                 .append('g').attr('class','blocksContainer')

        const amnt = (event.consumption/consumptionUnit).toFixed(0)
        array = [];
        for (var i = 0; i <amnt; i++) {
            array.push(1);
        }

        anntContainer.append('text').text( (+event.consumption).toFixed(2)+"kW")
              .attr('x', linesize/2 - 24)//xScale(event.start))
              .attr('y',55+svgHeight - svgMarginBottom + 40)
              .style('font-size','14px')
              .style('text-anchor','midle')
        
        y = -1;j=-1;

        blockC.selectAll('rect')
              .data(array, d => {return d})
              .join('rect')
              .attr('width',10)
              .attr('height',10)
              .attr('transform', (d,i) => { 

                if( (j)*15+5*(j-1)> linesize){ y++;j=0;}
                else{ j++; }
                // x = xScale(new Date(event.start)) + j*20;
                return 'translate('+(j*15+5)+','+(50+y*15+svgHeight - svgMarginBottom +75)+')';
              })
              .style('fill','#ff9620');

        anntContainer
            .append('image')
            .attr("xlink:href", '/static/imgs/event_icons/edit.svg')
            .attr("x", linesize/2 - 20)
            .attr("y", svgHeight - svgMarginBottom +5)
            .attr("width",40).attr("height", 40)
            .style('cursor','pointer')
            .attr('class','editBtn')
            .on('mouseover', (e) => {
                d3.select(e.srcElement).attr("width",38);
            })
            .on('mouseout', (e) => {
               d3.select(e.srcElement).attr("width",40);
            })
            .on('click', (e,d) => {
                editEvent(e,d)})

        setAnnotationBarVisibility();
    }

    function setAnnotationBarVisibility(){
        // Hide text in day view, hide everything in week view
        if( WINDOW == 24){
            d3.selectAll('.annotationBar text').style('opacity',0)
            d3.selectAll('.annotationBar image').style('opacity',1)
            d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)
            d3.selectAll('.annotationBar .editBtn').style('visibility','hidden')

        }else if(WINDOW == 24*7){
            d3.selectAll('.annotationBar text').style('opacity',0)
            d3.selectAll('.annotationBar image').style('opacity',0)
            d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)
            d3.selectAll('.annotationBar .editBtn').style('visibility','hidden')
        }else{
           d3.selectAll('.annotationBar text').style('opacity',1)
           d3.selectAll('.annotationBar image').style('opacity',1)
           d3.selectAll('.annotationBar .blocksContainer').style('opacity',1)
           d3.selectAll('.annotationBar .editBtn').style('visibility','visible')
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

            d3.select(parentNode).select('image')
                .attr("x", (xScale(end)-xScale(tmpDate))/2 - 20)

            d3.select(parentNode).selectAll('path.topAnnotationLine')
                .datum([0,(xScale(end)-xScale(tmpDate))])
                .attr('d', anntLine) 

            d3.select(parentNode).select('path.rightAnnotationLine')  
                .attr('d', 'M '+(xScale(end)-xScale(tmpDate))+','+(svgHeight- svgMarginBottom + 10)+' L'+(xScale(end)-xScale(tmpDate))+','+(svgHeight))

            d3.select(parentNode).select('text')
              .attr('x', (xScale(end)-xScale(tmpDate))/2 - 24)//xScale(event.start))

            // d3.select(parentNode).select('image')
            //     .attr("xlink:href", '/static/imgs/event_icons/edit.svg')
            //     .attr("x", linesize/2 - 20)


        })

        setAnnotationBarVisibility();
    }

    function updateXAxis(){
            xAxis = d3.axisTop()
                .ticks(15)
                .tickSize(-svgHeight+svgMarginBottom)
                .tickFormat(d3.timeFormat('%b %d %H:%M'))
                .scale(xScale);

            d3.selectAll(".x-axis.top")
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
    // d3.select('#saveCSVAnnotationBoxes').on('click', exportAnnotationsAsBoxes);

    async function exportCSVAnnotation(){
        resetTimeOfInactivity();

        d3.select('#spinner').style('display','block')

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
                    sanitised = (e[key]+'').replace(/,/g,' ')
                    pp += sanitised + ',';
            }
            pp = pp.slice(0, -1);
            csvContent += pp + "\n";
        });
        
        //https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        dateToday = new Date().getDate() +"-" + new Date().getMonth()+ "-"+new Date().getFullYear();
        link.setAttribute("download", "annotations-"+dateToday+".csv");
        document.body.appendChild(link); // Required for FF

        d3.select('#spinner').style('display','none')

        link.click(); // This will download the data file named "my_data.csv".
    }  

    async function exportCSVElectricity(){
        resetTimeOfInactivity();

        d3.select('#spinner').style('display','block')
   
        console.log('button#download-button');
        const sensor_id = sensorId;
        const measurement = 'electricity_consumption';
        // const measurement = 'TVOC'
        const url = `/measurement/${measurement}/sensor/${sensor_id}/rawdata/`;
        const now = luxon.DateTime.now();
        const today = new luxon.DateTime(now.year, now.month, now.day);
        const start = today.minus({weeks: 5});
        const total_days = luxon.Interval.fromDateTimes(start, today).length('days');
        let all_data = [];
        for (let d=0; d<=total_days; d+=1) {
            const curr = start.plus({'days': d});
            const next = curr.plus({'days': 1});
            console.log(`d: ${d}, curr: ${curr.toFormat('yyyy-LL-dd')}, next: ${next.toFormat('yyyy-LL-dd')}`);
            const query = `?start=${curr.toFormat('yyyy-LL-dd')}&end=${next.toFormat('yyyy-LL-dd')}&showAll=true&points=80`;
            const response = await d3.json(url+query);
            console.log('response:', response);
            all_data = all_data.concat(response.readings);
        }
        console.log('all_data:', all_data);

        let csv_content = "data:text/csv;charset=utf-8,";

        // save label names
        csv_content += 'time,value' + "\n";

        all_data.forEach(function(row) {
            csv_content += `${row.time},${row.value*SCALING_FACTOR}` + "\r\n";
        });        

        const encoded_uri = encodeURI(csv_content);
        var link = document.createElement("a");
        link.setAttribute("href", encoded_uri);
        link.setAttribute("download", `${measurement}_${sensor_id}.csv`);
        document.body.appendChild(link); // Required for FF
            
        d3.select('#spinner').style('display','none')

        link.click(); // This will download the data file named "my_data.csv".        
    };


    async function exportAnnotationsAsBoxes(){

        const A4_WIDTH = 1240
        const A4_HEIGHT = 1754

        const MAX_CURVE_KW = 12
        const MAX_CURVE_PIXELS = 658

        const MAX_HOUR_PIXELS = 99

        d3.select('#spinner').style('display','block')

        // Draw all the boxes. Only then try to save them
        try{
            result = await d3.json('/annotations');
    
            let svgBoxes = d3.select('#containerBoxes').append('svg')
                .attr('width', A4_WIDTH )///window.innerWidth)
                .attr('height',2*A4_HEIGHT)//*window.innerHeight)
                .append('g')
                // .attr('transform','translate('+margin.top+','+margin.left+')')

            let heightScale = d3.scaleLinear([0,MAX_CURVE_KW],[0,MAX_CURVE_PIXELS])
            let widthScale = d3.scaleLinear([0,60*60*1000],[0,MAX_HOUR_PIXELS])
     
            // sort by size
            result.sort((a,b)=>{
                return (+a.duration_seconds) - (+b.duration_seconds)
            })

            groups = svgBoxes.selectAll('g')
                .data(result, d => {return d})
                .join('g')

            groups.append('rect')
                .attr('height', d => {return heightScale(+d.consumption*60000/(+d.duration_seconds)); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', 0)
                .attr('y',d => { return 5*widthScale(+d.duration_seconds)/4 ; })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face1')
            groups.append('rect')
                .attr('height', d => {return heightScale(+d.consumption*60000/(+d.duration_seconds)); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return widthScale(+d.duration_seconds); })
                .attr('y',d => { return 5*widthScale(+d.duration_seconds)/4 ; })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face3')

            groups.append('rect')
                .attr('height', d => {return heightScale(+d.consumption*60000/(+d.duration_seconds)); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return 2*widthScale(+d.duration_seconds); })
                .attr('y',d => { return 5*widthScale(+d.duration_seconds)/4 ; })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face5')

            groups.append('rect')
                .attr('height', d => {return heightScale(+d.consumption*60000/(+d.duration_seconds)); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds); })
                .attr('y',d => { return 5*widthScale(+d.duration_seconds)/4 ; })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face6')

            groups.append('rect')
                .attr('height', d => {return heightScale(+d.consumption*60000/(+d.duration_seconds)); })
                .attr('width', d => { return widthScale(+d.duration_seconds)/4; })
                .attr('x', d => { return 4*widthScale(+d.duration_seconds); })
                .attr('y',d => { return 5*widthScale(+d.duration_seconds)/4 ; })
                .attr('fill','black') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','fold')

            groups.append('rect')
                .attr('height', d => {return widthScale(+d.duration_seconds); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return widthScale(+d.duration_seconds); })
                .attr('y',  d => { return widthScale(+d.duration_seconds)/4; })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face2')

            groups.append('rect')
                .attr('height', d => {return widthScale(+d.duration_seconds); })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return widthScale(+d.duration_seconds); })
                .attr('y',  d => { return heightScale(+d.consumption*60000/(+d.duration_seconds)) + 1.25*widthScale(+d.duration_seconds); })
                .attr('fill','#f9f9f9') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
                .attr('class','face3')

            groups.append('rect')
                .attr('height', d => {return widthScale(+d.duration_seconds)/4; })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return widthScale(+d.duration_seconds); })
                .attr('y',  d => { return heightScale(+d.consumption*60000/(+d.duration_seconds)) + 2.25*widthScale(+d.duration_seconds); })
                .attr('fill','black') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')
            .attr('class','fold')


            groups.append('rect')
                .attr('height', d => {return widthScale(+d.duration_seconds)/4; })
                .attr('width', d => { return widthScale(+d.duration_seconds); })
                .attr('x', d => { return widthScale(+d.duration_seconds); })
                .attr('y',  0)
                .attr('class','fold')
                .attr('fill','black') // DEFAFF // D0F7B7 // DDBABF //FFEAB0 //DDDDDD
                .style('stroke','black')

            groups.append('image')
                .attr('xlink:href', d => {return 'static/imgs/event_icons/' + d.type + '.svg'})
                // .text(d => { return d.type; })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds)/2-10 })
                .attr('y', d => {return 1.25*widthScale(+d.duration_seconds)+heightScale(+d.consumption*60000/(+d.duration_seconds))/3-25; })
                .attr('width',20)
                .attr('height',20)

            groups.append('text')
                .text(d => { return d.type; })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds)/2; })
                .attr('y', d => {return 1.25*widthScale(+d.duration_seconds)+heightScale(+d.consumption*60000/(+d.duration_seconds))/3+5; })
                .attr('text-anchor','middle')
                .attr('font-size',5)
                .style('font-weight','bold')

            groups.append('text')
                .text(d => { return d.description; })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds)/2; })
                .attr('y', d => {return 1.25*widthScale(+d.duration_seconds)+heightScale(+d.consumption*60000/(+d.duration_seconds))/3+20; })
                .attr('text-anchor','middle')
                .attr('font-size',5)

            groups.append('text')
                .text(d => { return (+d.consumption).toFixed(2)+"kWh"; })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds)/2; })
                .attr('y', d => {return 1.25*widthScale(+d.duration_seconds)+heightScale(+d.consumption*60000/(+d.duration_seconds))/3+50; })
                .attr('text-anchor','middle')
                .attr('font-size',5)
            groups.append('text')
                .text(d => { return Math.round(+d.duration_seconds/60000)+"minutes"; })
                .attr('x', d => { return 3*widthScale(+d.duration_seconds)/2; })
                .attr('y', d => {return 1.25*widthScale(+d.duration_seconds)+heightScale(+d.consumption*60000/(+d.duration_seconds))/3+40; })
                .attr('text-anchor','middle')
                .attr('font-size',5)

            let runningX = 0;
            let runningY = 0;
            let currentMaxY = 0;
            // let currentMaxX = 0;
            groups.each( (gg, i) => {
                // console.log(gg);

                if( runningX + 4.25*widthScale(gg.duration_seconds) + 4 > A4_WIDTH){
                    runningX = 0;
                    runningY += currentMaxY + 4;
                }
                d3.select(groups.nodes()[i]).attr('transform','translate('+runningX+','+runningY+')')
                runningX += 4*widthScale(gg.duration_seconds) + 40;
                if(  (heightScale(+gg.consumption*60000/gg.duration_seconds) + 4*widthScale(gg.duration_seconds)) > currentMaxY) {
                    currentMaxY = heightScale(+gg.consumption*60000/gg.duration_seconds) + 4*widthScale(gg.duration_seconds)
                }
            })
        }catch(e){
            console.log(e)
        }

        var html = d3.select("#containerBoxes svg")
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr('xmlns:xlink',"http://www.w3.org/1999/xlink")
        .node().parentNode.innerHTML;

        var link = document.createElement("a");
        link.setAttribute("href", "data:image/svg+xml;base64,\n" + btoa(html))
        link.setAttribute("download", 'annotation-boxes.svg');
        link.setAttribute("href-lang", "image/svg+xml")

        document.body.appendChild(link); // Required for FF
        link.click();

        d3.select('#spinner').style('display','none')


    };


    function updateSolarGeneration(){
        d3.select('#solarData')
          .transition()
          .attr('d',solarLine)
    }

    function getSunriseSunset(data, id){
        d3.json('https://api.sunrise-sunset.org/json?lat=51.509865&lng=-0.118092&date=today&formatted=0')
          .then(function (sun) {
            // console.log(data);

            d3.selectAll('div#container svg#'+id+'Chart')
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

        d3.selectAll('.backgroundData').selectAll('rect')
            .transition()
            .attr('x', d => { return xScale(d.time)})
            .attr('width', d => { 
                tmp = new Date(xScale.domain()[0]);
                tmp2 = new Date(tmp);
                tmp2.setHours(tmp2.getHours() + lengthOfNight);
                return (xScale(tmp2)- xScale(tmp)); 
            })

        d3.selectAll('.backgroundData').selectAll('text')
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

        d3.selectAll('.backgroundData').selectAll('rect')
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

            d3.selectAll('.backgroundData').selectAll('text')
              .data(nights)
              .join('text')
              .text('sunset')
              .attr('x', d => { return xScale(d.time)+10})
              .attr('y', 60)
              .style('font-style','italic')
              .style('font-size','14px')
              .attr('fill','gray')
   }

});