document.addEventListener("DOMContentLoaded", function() { 
    const DateTime = luxon.DateTime

    const urlParams = new URLSearchParams(window.location.search);
    const paramMeasurement = urlParams.get('measurement') ;
    const paramSensorid = urlParams.get('sensor');

    let startMinutes = 24*60;
    let endMinutes = 0;

    let data = {};
    let weatherData = [];
    let allEvents = [];

    let svgWidth = window.innerWidth; // This value gets overridden once the DIV gets created
    let svgHeight = 400 //svgWidth / 2 > window.innerHeight - 350? window.innerHeight -350:svgWidth / 2;

    const margin = 5;
    const padding = 5;
    const adj = 25;
    const svgMarginTop = 0;
    const svgMarginBottom = 80//window.innerHeight > 530 ? 300:200;
    const svgMarginLeft = 10;

    let sensorId = 96;
    let xScale, yScale, brush;
    let drawSolarGeneration = undefined;
    let loadData = undefined;

    event_types = ['window_open','window_closed','washing_and_drying','dishwasher','oven', 'occupancy',
                    'question_mark','air_cooling','heating_on','heating_off','showering_and_hair-drying',
                    'hob','ironing', 'other'
                   ];

    let FLAG = false;

    let timeOfInactivity = 5*60*1000;

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

 
    function getTickAmount(){
        interval = getIntervalRadio();

        const intervalLUT = {
            // '6h': 1,
            '12h': 1,
            '1d': 1,
            '5d': 5
        };

        return intervalLUT[interval];
    }

    /*Creates SVG & its title*/
    const appendSvg = async function (measurement) {
        console.log("Appended SVG "+ measurement.sensor_id)
        let name = measurement.name;

        svgContainer = d3.select("div#container")
            .select('#_'+measurement.sensor_id + 'Node')
            .append("div")
            .attr('class','graphContainer col-12')

        // Making the svg responsive
        svgWidth = d3.select(".graphContainer").node().getBoundingClientRect().width;

        // Check to see if it exists
        if(svgContainer.select('#_'+measurement.sensor_id + 'Chart').node() !== null ){
            return;
        }

        svgContainer
            .append("svg")
            .attr('id', "_"+measurement.sensor_id + 'Chart')
            .attr("viewBox", "-"
                + 1.5 * adj + " -"
                + 2.5*adj + " "
                + (svgWidth + adj*3) + " "
                + (svgHeight + adj))
            .style("padding", padding)
            .style("margin", margin)
            .attr('width',svgWidth - svgMarginLeft)
            .attr('height',svgHeight + svgMarginBottom)
            .classed("svg-content", true);
    }

    const appendDIV = function (measurement){
        console.log("Appended DIV "+ measurement.sensor_id)
        svgContainer = d3.select("div#container")
            .append("div")
            .attr('class','nodeContainer col-md-11 col-xl-6')
        
        svgContainer
        .append("h4")
        .attr('id', "_"+ measurement.sensor_id)
        .text("Sensor: #"+measurement.sensor_id.replace('_',' '));

       // Check to see if it exists
        if(svgContainer.select('#_'+measurement.sensor_id + 'Node').node() !== null ){
            return;
        }

        svgContainer
            .append("div")
            .attr('id', "_"+ measurement.sensor_id + 'Node')

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

        return d3.json(dataUrl).then( async function(response) {
                await drawGraphs(response,sensor_id,series);
            });
        }

    function formatData(data){
        let offset = 0;

        data = data.map(function (d) {
            return {
                time: luxon.DateTime.fromISO(d.time).toJSDate(),//timeConv(d.time),
                value: d.value
            }
        });
        return data;
    }

    async function drawGraphs (response, sensor_id, series){
        let newdata = formatData(response.readings);

        ret = ""
        result = await d3.json('/sensors');
        result.forEach( p => {
            if(p.sensor === sensor_id)
                { ret = p.label; }
        })
        
        d3.select("h4#_"+ sensor_id)
            .text("Sensor: "+ret)

        data[series.id] = []
        data[series.id] = newdata

        xrange = d3.extent(data[series.id], l => { return new Date(l.time).getTime() })

        xScale = d3.scaleTime(
            xrange,
            [svgMarginLeft, svgWidth]
        );

        // In case there are no data in the series
        if( data[series.id].length === 0){
            now = luxon.DateTime.now();

            min = now.minus({minutes: startMinutes})
            max = now.minus({minutes: endMinutes})

            xScale.domain([min,max])
        }

        yScaleHumidity = d3.scaleLinear(
            [0,110],
            [svgHeight-svgMarginBottom, (svgHeight-svgMarginBottom)/2+2])
      
        yScaleTemperature = d3.scaleLinear(
            [10,35],
            [(svgHeight-svgMarginBottom)/2-2, 0]
        );
        
        let xAxis = d3.axisTop()
            .ticks(10)
            .tickSize(-svgHeight+svgMarginBottom)
            .tickFormat(l => {
                format = d3.timeFormat('%I %p');
                if( format(l) === '12 AM'){ return}
                else{
                    return format(l).toLowerCase();
                }
            })
            .scale(xScale);

        let xAxisDays = d3.axisTop()
            .ticks(getTickAmount())
            .tickSize(-svgHeight+svgMarginBottom-30)
            .tickFormat(l => {
                format = d3.timeFormat('%e %b');
                return format(l); })
            .scale(xScale)

        let xAxisSecond = d3.axisBottom()
            .ticks(-1)
            .scale(xScale)

        let yAxis = d3.axisLeft()
            .scale(yScale); 

        let yAxisHumidity = d3.axisLeft()
            .ticks(5)
            .scale(yScaleHumidity)
            .tickFormat(l =>{ return l+'%'})
            .tickValues([20,40,60,80,100])

        let yAxisTemperature = d3.axisLeft()
            .ticks(5)
            .tickValues([15,20,25,30])
            .scale(yScaleTemperature)
            .tickFormat(l =>{ return l+'°C'})

        let svg = d3.select('svg#_' + series.sensor_id + 'Chart');

        svg.selectAll('#clip').remove();

        let label = capitalize(series.measurement);

        if( series.measurement == 'temperature'){
            
            svg.append("g")
                .attr("class", "axis")
                .call(yAxisTemperature)
                .attr('transform','translate('+svgMarginLeft+',0)')
                .append("text")
                    .attr("dy", ".75em")
                    .attr("y", 6)
                    .attr('x',10)
                    .style("text-anchor", "start")
                    .text(label)
                    .style('fill','#EF9F16')
                    .style('font-weight', 800)
                    .style('font-size',16);
            
            svg.append("g")
                .attr("class", "axis x-axis top")
                .attr("transform", "translate(0," + 0 + ")")
                .call(xAxis)
                    .selectAll("text")  
                    .style("text-anchor", "middle")
                    .attr("dx", "0em")
                    .attr("dy", "-.25em")
                    .attr('y',0)

            svg.append("g")
                .attr("class", "axis x-axis axisDays")
                .attr("transform", "translate(0," + (-30) + ")")
                .call(xAxisDays)
                    .selectAll("text")  
                    .style("text-anchor", "start")
                    .attr("dx", "0em")
                    .attr("dy", "-0.5em")
                    .attr('y',0)

            svg.append("g")
                .attr("transform", "translate(0," + (0) + ")")
                .attr("class", "axis x-axis")
                .call(xAxisSecond)

            svg.append("g")
                .attr("transform", "translate(0," + (svgHeight - svgMarginBottom) + ")")
                .attr("class", "axis x-axis")
                .call(xAxisSecond)

            svg.append("g")
                .attr("transform", "translate(0," + ((svgHeight - svgMarginBottom)/2) + ")")
                .attr("class", "axis x-axis separator")
                .call(xAxisSecond)
                
        }else{
             svg.append("g")
            .attr("class", "axis")
            .call(yAxisHumidity)
            .attr('transform','translate('+svgMarginLeft+',0)')
            .append("text")
                .attr("dy", ".75em")
                .attr("y", (svgHeight- svgMarginBottom)/2 + 6)
                .attr('x', 10)
                .style("text-anchor", "start")
                .text(label)
                .style('fill','cadetblue')
                .style('font-weight', 800)
                .style('font-size',16);
        }
        svg.append('clipPath')
              .attr("id", "clip")
              .append('rect')
              .attr('x',xScale.range()[0])
              .attr('y',yScaleTemperature.range()[1])
              .attr('width',xScale.range()[1]-xScale.range()[0])
              .attr('height',yScaleHumidity.range()[0]-yScaleTemperature.range()[1] + svgMarginBottom)

        // Add clipping path for making the animation look better
        // But make sure it doesnt exist first.
        if(svg.select('.annotations').node() === null ){
           svg.append('g').attr('class','annotations').attr("clip-path", "url(#clip)")
        }

        if(svg.select('.dataPoints').node() === null ){
            svgGroup = svg.append("g").attr("class","dataPoints")
                            .attr("clip-path", "url(#clip)");
        }

        let lineH = d3.line()
            .defined(d => d.value)
            .x(d => xScale(d.time))
            .y(d => yScaleHumidity(d.value))

        let lineT = d3.line()
            .defined(d => d.value)
            .x(d => xScale(d.time))
            .y(d => yScaleTemperature(d.value))

        updateGraph = function (dataF, firstCall){

            // svg.select('.dataPoints').select('*').remove()

            svg = d3.select('svg#_' + series.sensor_id + 'Chart');

            if( series.measurement == 'temperature'){
                // https://bocoup.com/blog/showing-missing-data-in-line-charts
                var filteredDataT = dataF.filter(lineT.defined());
                
                filteredDataT.sort( (a,b)=>{
                    return luxon.DateTime.fromJSDate(a.time).toMillis() - luxon.DateTime.fromJSDate(b.time).toMillis()
                })

                svg.select('.dataPoints')
                    .append("path")
                    .attr('class','segments-line')
                    .datum(dataF)
                    .attr("d", lineT)
                    .style('stroke', '#EF9F16')
                    .attr('pointer-events', 'visibleStroke')

                svg.select('.dataPoints')
                    .append("path")
                    .attr('class','gapline')
                    .attr('d', lineT(filteredDataT))
                    .style('stroke', '#EF9F16')

                svg.append("rect")
                   .attr('width',svgWidth - svgMarginLeft)
                   .attr('x',svgMarginLeft)
                   .attr('y', yScaleTemperature(22))
                   .attr('height', yScaleTemperature(17) - yScaleTemperature(22) )
                   // .attr('fill','#EF9F16')
                   .attr('fill','url(#Gradient1)')
                   .style('opacity', 0.2)

                if(dataF.length > 0){
                    circleLocStart = 0
                    circleLocEnd = dataF.length - 1

                    for(k = 0; k < dataF.length; k++){
                        if( dataF[k].value !== null ){
                          circleLocStart = k;
                          break;
                        }
                    }

                    for(k = dataF.length-1; k>=0; k--){
                        if( dataF[k].value !== null ){
                          circleLocEnd = k;
                          break;
                        }
                    }

                    svg.append('text').text(Math.round(dataF[circleLocStart].value)+ "\xB0C")
                            .attr('x', xScale(dataF[circleLocStart].time) +5)
                            .attr('y', yScaleTemperature(dataF[circleLocStart].value) - 10)
                           .style('fill', '#EF9F16')
                           .style('font-size','12px')

                    svg.append('circle').attr('r',6)
                            .attr('cx', xScale(dataF[circleLocStart].time) )
                            .attr('cy', yScaleTemperature(dataF[circleLocStart].value))
                           .style('fill', '#EF9F16')


                    if(xScale(dataF[circleLocEnd].time) - xScale(dataF[circleLocStart].time) > 40){

                        svg.append('text').text(Math.round((dataF[circleLocEnd].value))+ "\xB0C")
                                .attr('x', xScale(dataF[circleLocEnd].time)  )
                                .attr('y', yScaleTemperature(dataF[circleLocEnd].value) - 10)
                               .style('fill', '#EF9F16')
                               .style('font-size','12px')
                    }

                    svg.append('circle').attr('r',6)
                            .attr('cx', xScale(dataF[circleLocEnd].time) )
                            .attr('cy', yScaleTemperature(dataF[circleLocEnd].value))
                           .style('fill', '#EF9F16')
                }
            }else{
               var filteredDataH = dataF.filter(lineH.defined());

                filteredDataH.sort( (a,b)=>{
                    return luxon.DateTime.fromJSDate(a.time).toMillis() - luxon.DateTime.fromJSDate(b.time).toMillis()
                })

               svg.select('.dataPoints')
                    .append("path")
                    .attr('class','segments-line')
                    .datum(dataF)
                    .attr("d", lineH)
                    .style("stroke",'cadetblue')

               svg.select('.dataPoints')
                    .append("path")
                    .attr('class','gapline')
                    .attr('d', lineH(filteredDataH))
                    .style("stroke",'cadetblue')

                context = svg.append('g').attr('class','context')

                context.append("rect")
                   .attr('width',svgWidth - svgMarginLeft)
                   .attr('y', yScaleHumidity(65))
                   .attr('x',svgMarginLeft)
                   .attr('height', yScaleHumidity(35) - yScaleHumidity(65) )
                  .attr('fill','url(#Gradient2)')
                   .style('opacity',0.2)

                if(dataF.length > 0){
                    circleLocStart = 0
                    circleLocEnd = dataF.length - 1

                    for(k = 0; k < dataF.length; k++){
                        if( dataF[k].value !== null ){
                          circleLocStart = k;
                          break;
                        }
                    }

                    for(k = dataF.length-1; k>=0; k--){
                        if( dataF[k].value !== null ){
                          circleLocEnd = k;
                          break;
                        }
                    }

                    context.append('circle').attr('r',6)
                            .attr('cx', xScale(dataF[circleLocStart].time) )
                            .attr('cy', yScaleHumidity(dataF[circleLocStart].value))
                            .style("fill",'cadetblue')

                    context.append('text').text(Math.round(dataF[circleLocStart].value) + "%")
                            .attr('x', xScale(dataF[circleLocStart].time) +5)
                            .attr('y', yScaleHumidity(dataF[circleLocStart].value) - 10)
                            .style('font-size','12px')
                            .style('fill', 'cadetblue')

                    if(xScale(dataF[circleLocEnd].time) - xScale(dataF[circleLocStart].time) > 40){

                        context.append('text').text(Math.round(dataF[circleLocEnd].value)+"%")
                                .attr('x', xScale(dataF[circleLocEnd].time))
                                .attr('y', yScaleHumidity(dataF[circleLocEnd].value) - 10)
                               .style('fill', 'cadetblue')
                               .style('font-size','12px')
                    }

                    context.append('circle').attr('r',6)
                            .attr('cx', xScale(dataF[circleLocEnd].time))
                            .attr('cy', yScaleHumidity(dataF[circleLocEnd].value))
                            .style("fill",'cadetblue')
                }
            }
        }

        addBrushing = function (){
            brush = d3.brushX()
                        .extent([[svgMarginLeft,0], [svgWidth, svgHeight-svgMarginBottom]])
                        .on('start', brushStart)
                        .on('end', brushEnd)
                        .on('brush', brushing)
            
            let brushContainer = svg.append("g")
                                    .attr('class','brush')
                                    .call(brush)

            function brushStart({selection}) {
                resetTimeOfInactivity();
                
                // d3.selectAll('.tooltip').style('display','none')

                console.log('brush started');
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

                    interval = d3.timeMinute.every(5) // 30 // check for 30min
    
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
                    // for (const e of allEvents){
                    //     tmpStart = new Date(e.start);
                    //     tmpEnd = new Date(tmpStart.getTime() + (+e.duration_seconds));

                    //     if ( (sx[0] < tmpEnd && sx[0]>= tmpStart) ||
                    //          (sx[1] <= tmpEnd && sx[1]> tmpStart)){
                    //         clearBrushSelection();
                    //         brushContainer.call(brush.move,null);
                    //         d3.select('#infoBox').html('You cannot have overlapping annotations').style('display','block');
                    //         return;
                    //     }
                    // }

                    dat = data[series.id].filter( r =>{
                        if( r.time >= sx[0] && r.time < sx[1]){
                            return true;
                        }
                    }); 

                    // svg.selectAll('.dataPoints rect').style("opacity", d => { 
                    //     return sx[0] <= d.time && d.time < sx[1] ? "1" : '0.2'; });

                    // Create a button to save event
                    svg.append('g')
                      .attr('class','saveBtnContainer')
                      .style('cursor','pointer')
                      .on('click', () => { createEvent(sx,series.id,series.measurement,series.sensor_id); })
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

            function createEvent(selection, seriesID, measurement, sensor){
                let evnt = {};

                // TODO MAKE GENERAL
                d3.select('#dialogueBox h4').html('Create Event')
                d3.select('#dialogueBox').attr('isCreate','true')

                evnt.series = seriesID;
                evnt.measurement = measurement;
                evnt.sensor_id = sensor;

                evnt.flexibility = ''
                evnt.description = ''

                // TODO: add more acccurate time mapping based on the bars not the brushing
                evnt.start = selection[0]; 
                evnt.end = selection[1];

                evnt.duration_seconds = evnt.end.getTime() - evnt.start.getTime();

                // const event_readings = data[series.id].filter(d => {
                //     return (new Date(d.time)).getTime() >= evnt.start.getTime() && (new Date(d.time)).getTime() < evnt.end.getTime();
                // });

                // evnt.duration_seconds = d3.max(event_readings, d => d.time).getTime() - d3.min(event_readings, d => d.time).getTime();

                evnt.consumption = 0
                // evnt.consumption = d3.sum(event_readings, d => d.value);
                // evnt.consumption = ((SAMPLING_INTERVAL)/60) * d3.sum(event_readings, d => d.value); // - always_on;
                                //  / number of samples (lenth of array) * (duration_minutes/60) 

                show_event_dialog(evnt);
            }

            function resetDialogue(){
                d3.select('#dialogueBox #infoBoxDialogue').html('').style('display','none');
            }

            function getDialogueValues(type){
                resetTimeOfInactivity();

                let evnt = {};

                if( type == 'create'){
                    evnt.description = d3.select('#dialogueBox #evntDescription').node().value;
                    evnt.start =  new Date( d3.select('#dialogueBox #evntStart').node().value); 
                    evnt.duration_seconds = d3.select('#dialogueBox #evntDuration').node().value;
                    evnt.consumption =  0;
                    evnt.type = d3.select('#dialogueBox #iconField img.selected').node().alt;                
                }else{
                    evnt.description = d3.select('#dialogueBox #evntDescription').node().value;
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

                printDate = d3.timeFormat('%b %d %H:%M');

                durationInHours = Math.floor(+evnt.duration_seconds / 60000 / 60);
                durationInMinutes = (+evnt.duration_seconds/60000) % 60;
                durationLabel = durationInHours.toFixed(0) + " hours and "+ durationInMinutes.toFixed(0) +" minutes";

                d3.select('#dialogueBox #evntDurationLabel').html(durationLabel);
                d3.select('#dialogueBox #evntStartLabel').html(printDate( new Date(evnt.start)));

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

                d3.select('#dialogueBox #evntDescription').node().value = evnt.description;

                d3.select('#dialogueBox #evntStart').node().value = evnt.start;
                d3.select('#dialogueBox #evntDuration').node().value = evnt.duration_seconds;
                d3.select('#dialogueBox #evntType').node().value = evnt.type;
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
                        d3.select('#infoBoxDialogue').html('Please choose an event type.')
                                            .style('display','block')
                        return;                       
                    }

                    if( d3.select('#dialogueBox').attr('isCreate') == 'true'){
                        
                        console.log('CREATE EVENT for series: '+ event.series)  
                        createNewAnnotation(event.series,event.sensor_id,event.measurement);

                        async function createNewAnnotation(eventSeries,eventSensor_id,eventMeasurement)
                        {
                            // If new Push this event to a list of all
                            let event = getDialogueValues('create')
                            let eventSanitized = {
                                    'start': event.start.toISOString(),
                                    'duration_seconds':+event.duration_seconds,
                                    'type': event.type,
                                    'description':event.description,
                                    'consumption': 0,
                                    'flexibility': '',
                                    'sensor': eventSensor_id, 
                                    'measurement': eventMeasurement
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

                                addAnnotationBar(event,eventSanitized.id, eventSensor_id);
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
                    // tmpDate = new Date(event.start);
                    // d3.select('#'+event.series+'Chart .annotations').append('rect')
                    //         .attr('class','highlighted')
                    //         .attr('x', xScale(tmpDate) )
                    //         .attr('y', 0)
                    //         .attr('width', xScale((tmpDate.getTime() + (+event.duration_seconds))) -  xScale(tmpDate) )
                    //         .attr('height', yScale(0))

                    // d3.selectAll('#'+event.series+'Chart .dataPoints rect').filter( d => { 
                    //     return d.time >= event.start && d.time < (event.start.getTime() + (+event.duration_seconds));
                    // })
                    // .classed('annottated',true)

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
                            // d3.selectAll('#'+series.id+'Chart .dataPoints rect').filter( d => { 
                            //     return d.time >= tmpEvntStart && d.time <= (tmpEvntStart.getTime() + (+allEvents[index].duration_seconds));
                            // })
                            // .classed('annottated',false)
                            // .style('fill', 'rgba(100,100,100,1)')

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
                // FLAG = false;
            }

            d3.select('#closebtnDialogue').on('click', closeDialogue);

            function clearBrushSelection(){
                svg.select('.saveBtnContainer').remove();
                svg.selectAll('#'+series.id+'Chart .dataPoints rect').style("opacity", '1');
            }
        }

        updateGraph(data[series.id],true);

        // TODO make more elegant. This should be called after all measures are drawn
        if( series.measurement == 'temperature'){
            drawAnnotations(series);
            addBrushing();
            addTooltip(svg,data,series.sensor_id);
            svg.select('.overlay').raise()
       }
    }
    
    function addTooltip(svg, dataL,sensor_id){
        const tooltip = svg.append('g')
            .style('display', 'none')
            .attr('class','tooltip')
            .attr('id',"tooltip_"+sensor_id)
            .style('font-size','11px')
            .style('opacity',1)

        tooltip.append('path')
            .attr('d', 'M 0,'+(-20) +' L 0,'+0)
            .style('display', 'block')

        const tooltipTExt = tooltip.append('g')

        tooltipTExt.append('rect')
            .style('display', 'block')
            .attr('x', 0)
            .attr('y', -20)
            .attr('width', 140)
            .attr('height', 50)
            .attr('fill', 'rgba(240, 240, 240, .7)');

        tooltipTExt
            .append('text')
            .attr('class','top')
            .style('display', 'block')
            .style('font-weight','800')
            .attr('x', 5)
            .attr('y', -5)
        
        tooltipTExt
            .append('text')
            .attr('class','bottom temp')
            .style('display', 'block')
            .attr('x', 5)
            .attr('y', 10)

        tooltipTExt
            .append('text')
            .attr('class','bottom hum')
            .style('display', 'block')
            .attr('x', 5)
            .attr('y', 23)

        svg.select('.overlay').on('mousemove', mousemove)
        // svg.select('.overlay').on('mouseout', () => {
        //     d3.select("#tooltip_"+sensor_id).style('display','none')
        // })

        bisectDate = d3.bisector((d) => { return d.time; }).left;

        function mousemove(){ 

            x0 = xScale.invert(d3.pointer(event,this)[0])
            ff = DateTime.fromJSDate(x0);

            s_idA = "temperature_"+sensor_id
            s_idB = "humidity_"+sensor_id

            i = bisectDate(dataL[s_idA], x0, 1),
                      d0 = dataL[s_idA][i - 1],
                      d1 = dataL[s_idA][i],
                      dA = x0 - d0.time > d1.time - x0 ? d1 : d0;
            i = bisectDate(dataL[s_idB], x0, 1),
                      d0 = dataL[s_idB][i - 1],
                      d1 = dataL[s_idB][i],
                      dB = x0 - d0.time > d1.time - x0 ? d1 : d0;

            tooltip.select('text.top').text( ff.toFormat('LLL dd, h:mm a') )

            if(dA.value === null){ 
                tooltipTExt.select('text.bottom.temp').text("temperature: -" )
            }else{
                tooltipTExt.select('text.bottom.temp').text("temperature: " + dA.value.toFixed(1)+"\xB0C" )
            }
            if(dB.value === null){ 
               tooltipTExt.select('text.bottom.hum').text("humidity: -" )
            }else{
               tooltipTExt.select('text.bottom.hum').text("humidity: " + dB.value.toFixed(1)+"%" )
           }

           offset = -180
           if( d3.pointer(event,this)[0] + offset < 0 ){
            offset = 50
           }

            tooltipTExt.style('display', 'block')
                    .attr("transform", `translate(${offset},${d3.pointer(event,this)[1]})`)
           tooltip
                .style('display', 'block')
                // .attr("transform", `translate(${d3.pointer(event,this)[0]},10)`)
                .attr("transform", `translate(${d3.pointer(event,this)[0]},1)`)
                .raise();
        }
    } 
    
    d3.select('#btnEarlier').on('click', getEarlierData_new);
    d3.select('#btnLater').on('click', getLaterData_new);

    function getIntervalRadio(){
        const selectedId = d3.select('#intervalRadio :checked').attr('id');
        const interval = d3.select(`label[for=${selectedId}]`).node().innerHTML;

        return interval;
    }

    d3.select('#intervalRadio').on('change', function () {

        let interval = getIntervalRadio();

        endMinutes = 0;
        d3.select('#btnLater').node().disabled = true;
        
        const intervalLUT = {
            // '6h': 6 * 60,
            '12h': 12 * 60,
            '1d': 24 * 60,
            '5d': 5 * 24 * 60
        };

        startMinutes = intervalLUT[interval];
        
        loadData();
    });

    function addWeatherData(){

        callWeatherAPI = function(m){
            apiCall = 'http://api.weatherapi.com/v1/history.json?key=1decd531f0a04a159be91830232501&q=London&dt=';
            
            return d3.json(apiCall+m).then(function (response) {
                response.forecast.forecastday[0].hour.forEach(p => { weatherData.push(p);})
                console.log(weatherData)
            });
        }
 
        now = DateTime.now();
        startDate = now.minus({minutes: startMinutes})//.toISODate();
        
        if(endMinutes){
            endDate = now.minus({minutes: endMinutes})//.toISODate();
        }else{
            endDate = now;
        }

        allDays = [];
        for(i=0; i<=endDate.diff(startDate, 'days').values.days;i++ ){
            allDays.push(startDate.plus({days:i}).toISODate() )
        }
        console.log(allDays)
        
        weatherData = [];

        const promisesW = allDays.map(m => callWeatherAPI(m));
        Promise.all(promisesW).then( () => {
            console.log('all weather loaded');
            console.log(weatherData)
            drawWeatherGraph();
        });

        drawWeatherGraph = function(){

            d3.select('.weatherContainer').remove();
            svgContainer = d3.select("div#container")
                .append("div")
                .attr('class','nodeContainer weatherContainer col-md-11 col-xl-6')

            svgContainer
                .append("h4")
                .attr('id', "weatherContainer")
                .text("Outdoor Temperature");
           
            svgContainer = d3.select("div#container")
                .select('.weatherContainer')
                .append("div")
                .attr('class','graphContainer col-12')

            // Making the svg responsive
            svgWidth = d3.select(".graphContainer").node().getBoundingClientRect().width;

            svg = svgContainer
                .append("svg")
                .attr('id', 'weatherChart')
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", "-"
                    + 1.5 * adj + " -"
                    + 2.5*adj + " "
                    + (svgWidth + adj*3) + " "
                    + (svgHeight + adj))
                .style("padding", padding)
                .style("margin", margin)
                .attr('width',svgWidth - svgMarginLeft)
                .attr('height',svgHeight + svgMarginBottom)
                .classed("svg-content", true);
            
            now = luxon.DateTime.now();

            min = now.minus({minutes: startMinutes})
            max = now.minus({minutes: endMinutes})

            xScaleW = d3.scaleTime([min,max],[svgMarginLeft, svgWidth]);
            console.log(xScaleW.domain())

            yScaleOutdoorTemp = d3.scaleLinear(
                [-5,30],// d3.extent(weatherData, f => { return f.temp_c; }),
                [(svgHeight-svgMarginBottom)-2, 0]
            );

            lineW = d3.line()
            .defined(d => d.temp_c)
            .x(d => xScaleW(DateTime.fromFormat(d.time,'yyyy-MM-dd hh:mm')) )
            .y(d => yScaleOutdoorTemp(d.temp_c))

            let xAxis = d3.axisTop()
            .ticks(10)
            .tickSize(-svgHeight+svgMarginBottom)
            .tickFormat(l => {
                format = d3.timeFormat('%I %p');
                if( format(l) === '12 AM'){ return}
                else{
                    return format(l).toLowerCase();
                }
            })
            .scale(xScaleW);
           
            let xAxisSecond = d3.axisBottom()
            .ticks(0)
            .scale(xScaleW);

            let yAxisOutdoorTemp = d3.axisLeft()
                .ticks(7)
                .tickValues([-5,0,5,10,15,20,25,30])
                .scale(yScaleOutdoorTemp)
                .tickFormat(l =>{ return l+'°C'})
           
            let xAxisDays = d3.axisTop()
            .ticks(getTickAmount())
            .tickSize(-svgHeight+svgMarginBottom-30)
            .tickFormat(l => {
                format = d3.timeFormat('%e %b');
                return format(l); })
            .scale(xScaleW)

            svg.append('clipPath')
              .attr("id", "clip")
              .append('rect')
              .attr('x',xScaleW.range()[0])
              .attr('y',yScaleOutdoorTemp.range()[1])
              .attr('width',xScaleW.range()[1]-xScaleW.range()[0])
              .attr('height',yScaleOutdoorTemp.range()[0]-yScaleOutdoorTemp.range()[1] + svgMarginBottom)
            
            svgGroup = svg.append("g").attr("class","dataPoints")
                            .attr("clip-path", "url(#clip)");

            svg.append("g")
                .attr("class", "axis x-axis top weather")
                .attr("transform", "translate(0," + 0 + ")")
                .call(xAxis)
                    .selectAll("text")  
                    .style("text-anchor", "middle")
                    .attr("dx", "0em")
                    .attr("dy", "-.25em")
                    .attr('y',0)
            
            svg.append("g")
                .attr("class", "axis x-axis axisDays")
                .attr("transform", "translate(0," + (-30) + ")")
                .call(xAxisDays)
                    .selectAll("text")  
                    .style("text-anchor", "start")
                    .attr("dx", "0em")
                    .attr("dy", "-0.5em")
                    .attr('y',0)

            svg.append("g")
                .attr("class", "axis x-axis top weather")
                .attr("transform", "translate(0," + (yScaleOutdoorTemp(0)) + ")")
                .call(xAxisSecond)

            svg.append("g")
                .attr("class", "axis")
                .call(yAxisOutdoorTemp)
                .attr('transform','translate('+svgMarginLeft+',0)')
                .append("text")
                    .attr("dy", ".75em")
                    .attr("y", 6)
                    .attr('x',10)
                    .style("text-anchor", "start")
                    .text('Outdoor Temperature')
                    .style('fill','black')
                    .style('font-weight', 800)
                    .style('font-size',16);

            weatherData = weatherData.sort( (a,b) => {
               return DateTime.fromFormat(a.time,'yyyy-MM-dd hh:mm') < DateTime.fromFormat(b.time,'yyyy-MM-dd hh:mm')
            })

            svgGroup.append("path")
                .attr('class','weatherline')
                .attr('d', lineW(weatherData))
                .style('stroke', 'black')
                .style('stroke-width',3)

        }
    }

    let seriesUrl = '/series/?showAll=true';

    d3.json(seriesUrl).then(function (allSeries) {
        console.log(allSeries)

        if( paramMeasurement && paramSensorid){
            toKeep = paramMeasurement;
        }else{
            toKeep = [
                    "temperature",
                    "humidity"
                 ];
        }

        allSeries = allSeries.filter(function (d) {
            return (toKeep.includes(d.measurement) && d.sensor_id<50 && d.sensor_id>9)
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
            d3.select("div#container").selectAll('div.nodeContainer').remove();

            // sort by size
            _series.sort((a,b)=>{
                return (a.sensor_id) - (b.sensor_id)
            })

            tmp = []
            _series.forEach(m => {
                if (tmp.indexOf(m.sensor_id) == -1)
                {   
                    appendDIV(m);
                    appendSvg(m);
                    tmp.push(m.sensor_id)
                }
            });

            // addWeatherData()

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
            if(FLAG === false){
                window.location.reload();
            }
        }

        startTimer();

        function startTimer() { 
            // window.setTimeout returns an Id that can be used to start and stop a timer
            timeoutId = window.setTimeout(refreshData, timeOfInactivity)
            // timeoutId = 1;
        }

        resetTimeOfInactivity = function (){
     
            window.clearTimeout(timeoutId)
            startTimer();

            timeOfInactivity = 5*60*1000;
        }

 /*       d3.select('select#measurementSelect')
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
*/

    });

    function getLaterData_new(){
        console.log('later clicked');

        deltaMinutes = startMinutes - endMinutes;
        const step = deltaMinutes / 4;
        endMinutes = endMinutes - step;
        startMinutes = startMinutes - step;
        
        if (endMinutes === 0) {
            d3.select('#btnLater').node().disabled = true;
        }

        loadData();
    }

    function getEarlierData_new(){
        console.log('earlier clicked');

        d3.select('#btnLater').node().disabled = false;

        deltaMinutes = startMinutes - endMinutes;
        const step = deltaMinutes / 4;
        endMinutes = endMinutes + step;
        startMinutes = startMinutes + step;
                
        loadData();
    }

    async function drawAnnotations(series){
        try{
            d3.select('#spinner').style('display','block');

            result = await d3.json('/annotations');
            d3.selectAll('.annotationBar ').remove()

            allEvents = result;
            allEvents.forEach( g => {
                tmpDate = new Date(g.start);

                addAnnotationBar(g, g.id, g.sensor);
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

    function addAnnotationBar(event,id,seriesID){

        const anntLine = d3.line()
                     .x(d => (d))
                     .y(svgHeight - svgMarginBottom )

        event.id = id;

        tmpDate = new Date(event.start);

        anntContainer = d3.select('#_'+seriesID+'Chart .annotations')
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
            .attr('stroke-width','3px')

        // anntContainer.append('path')
        //             .attr('class','middleAnnotationLine')
        //             .attr('d', 'M '+(linesize/2)+','+(svgHeight - svgMarginBottom + 10)+' L '+(linesize/2)+','+(svgHeight))
        //             .attr('stroke-width','1px')
        //             // .attr('stroke-dasharray','3')

        // anntContainer.append('path')
        //             .attr('class','leftAnnotationLine')
        //             .attr('d', 'M 0,'+(svgHeight - svgMarginBottom + 10)+' L 0,'+(svgHeight))
        //             .attr('stroke-width','0.5px')
        //             .attr('stroke-dasharray','3')

        // anntContainer.append('path')
        //             .attr('class','rightAnnotationLine')
        //             .attr('d', 'M '+(linesize)+','+(svgHeight- svgMarginBottom + 10)+' L'+(xScale(event.end)-xScale(tmpDate))+','+(svgHeight))
        //             .attr('stroke-width','0.5px')
        //             .attr('stroke-dasharray','3')

        anntContainer.append('rect').attr('class','highlighted')
                .attr('x', 0 )
                .attr('y', 0)
                .attr('width', xScale(event.end)-xScale(tmpDate) )
                .attr('height', yScaleHumidity(0))

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
            .attr("x", linesize/2 - 27.5 )
            .attr("y", svgHeight - svgMarginBottom +5)
            // .attr("y", svgMarginTop-50)
            .attr("width",55).attr("height", 55)

        anntContainer
            .append('image')
            .attr("xlink:href", '/static/imgs/event_icons/edit.svg')
            .attr("x", linesize/2 - 17.5)
            .attr("y", svgHeight - svgMarginBottom +23+30)
            .attr("width",35).attr("height", 35)
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
        // // Hide text in day view, hide everything in week view
        // if( WINDOW == 24){
        //     d3.selectAll('.annotationBar text').style('opacity',0)
        //     d3.selectAll('.annotationBar image').style('opacity',1)
        //     d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)
        //     d3.selectAll('.annotationBar .editBtn').style('visibility','hidden')

        // }else if(WINDOW == 24*7){
        //     d3.selectAll('.annotationBar text').style('opacity',0)
        //     d3.selectAll('.annotationBar image').style('opacity',0)
        //     d3.selectAll('.annotationBar .blocksContainer').style('opacity',0)
        //     d3.selectAll('.annotationBar .editBtn').style('visibility','hidden')
        // }else{
        //    d3.selectAll('.annotationBar text').style('opacity',1)
        //    d3.selectAll('.annotationBar image').style('opacity',1)
        //    d3.selectAll('.annotationBar .blocksContainer').style('opacity',1)
        //    d3.selectAll('.annotationBar .editBtn').style('visibility','visible')
        // }
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

/*
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
    }*/

 /*   function getSunriseSunset(data, id){
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
*/
});