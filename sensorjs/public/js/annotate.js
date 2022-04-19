document.addEventListener("DOMContentLoaded", function() { 
    let startMinutes = 60*24;
    let endMinutes = 0;

    let svgWidth = window.innerWidth;
    let svgHeight = svgWidth / 2 > window.innerHeight - 250 ? window.innerHeight - 250:svgWidth / 2;
    
    const margin = 5;
    const padding = 5;
    const adj = 30;

    var xScale, yScale;
    const svgMarginTop = 40;
    const svgMarginLeft = 20;

    let allEvents = [];
    let ids = 0;

    // TODO fix which activities are included >>> make them activities not devices!
    event_types = ['washing_and_drying','housework','dishwasher','kettle','microwave','oven',
                    'question_mark','toaster','air_cooling','heating'];

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

    /*Creates SVG & its title*/
    const appendSvg = function (measurement) {
        let name = measurement.name;
    
        svgContainer = d3.select("div#container");

        svgContainer
            .append("h4")
            .attr('id', measurement.id)
            .text(name);

        svgContainer
            .append("svg")
            .attr('id', measurement.id + 'Chart')
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "-"
                + 1.5 * adj + " -"
                + adj + " "
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

        let dataUrl = `/measurement/${measurement}/sensor/${sensor_id}/data/?start=-${startMinutes}`;
        if (endMinutes > 0) {
            dataUrl = dataUrl + `&end=-${endMinutes}`;
        }

        return d3.json(dataUrl).then(function (response) {
            console.log(response);
            drawGraphs(response,series);
            addBrushing(response);
        });
    }

    function drawGraphs (response,series){

        let data = response.readings;

        let offset = 0;

        // d3.csv('/static/data/100_electricity_consumption.csv')
        //   .then(function(data) {
        //       console.log("ddd")
        //       console.log(data)
        // })

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

        //const bisectTime = d3.bisector(function(d) { return d.time; }).left;
        const tzOffset = 0;//(new Date()).getTimezoneOffset() * 60000;

        xScale = d3.scaleTime(
            d3.extent(data, d => new Date(d.time.getTime() - tzOffset)),
            [0, svgWidth-svgMarginLeft]
        );

        let yScale = d3.scaleLinear(
            [(0), 1.1 * d3.max(data, d => +d.value)],
            // [(0.9 * (response.min + offset)), 1.1 * (response.max + offset)],
            [svgHeight, svgMarginTop]
        );
        
        let xAxis = d3.axisBottom()
            .ticks(15)
            .tickFormat(d3.timeFormat('%b %d %H:%M'))
            .scale(xScale);

        let yAxis = d3.axisLeft()
            .scale(yScale); 

        let svg = d3.select('svg#' + series.id + 'Chart');
        svg.selectAll("*").remove();

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + svgHeight + ")")
            .call(xAxis)
                .selectAll("text")  
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");
    
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

        const tooltip = svg.append('g')
            .style('display', 'none');

        tooltip
            .append('rect')
            .style('display', 'block')
            .attr('x', 0)
            .attr('y', -20)
            .attr('width', 140)
            .attr('height', 20)
            .attr('fill', 'rgba(240, 240, 240, .7)');

        tooltip
            .append('text')
            .style('display', 'block')
            .attr('x', 5)
            .attr('y', -5)
            .text('hello');

        let line = d3.line()
            .defined(d => d.value)
            .x(d => xScale(d.time)+1)
            .y(d => yScale(d.value));

        svgGroup = svg.append("g").attr("class","dataPoints");

        svgGroup.append("path")
            .datum(data)
            .attr("d", line);

        svgGroup.selectAll('rect')
            .data(data)
            .enter().append("rect")
                .style("fill", "rgba(90,90,90,1)")
                .attr("x", function(d) { return xScale(new Date(d.time.getTime() - tzOffset)); })
                .attr("width", 10) //x.rangeBand())
                .attr("y", function(d) { return yScale(d.value); })
                .attr("height", function(d) {
                    if (svgHeight - yScale(d.value) < 0) {
                        console.log(d);
                        return 0;
                    } 
                    if (d.value === null) {
                        return 0;
                    } else {
                        return svgHeight - yScale(d.value);
                    }
                })
    
        addSunriseSunset();

    }

    d3.json('/settime/', {
        method: 'POST', 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({
            'datetime': (new Date()).toISOString()
        })
    }).then(function (data) {
        console.log('settime post response:', data);
  
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

            // "&& d.sensor_id==100;" >> temporary FIX!!
            allSeries = allSeries.filter(function (d) {
                return toKeep.includes(d.measurement) && d.sensor_id==100;
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
                d3.select("div#container").selectAll('div.graphContainer').remove();
                _series.forEach(m => appendSvg(m));
                d3.select('div.main-loading').style('display', 'block');
                const promises = _series.map(m => loadMeasurementData(m));
                Promise.all(promises).then(function () {
                    console.log('all loaded');
                    d3.select('div.main-loading').style('display', 'none');
                });
            };

            _series = allSeries.map(function (d) {return d;});

            loadData();

        });
    });

    function addBrushing (response){

        evnt = {
            'start' :'',
            'end'   : '',
            'duration': 0,
            'consumption': 0,
            'id':'',
            'type':'',
            'notes':''
        }

        const brush = d3.brushX()
                        .extent([[0,svgMarginTop], [svgWidth+20, svgHeight]])
                        .on('start', brushStart)
                        .on('end', brushEnd)
                        .on('brush', brushing)

        let brushContainer = d3.selectAll("div#container svg")
              .append("g")
              .attr('class','brush')
              .call(brush)

        function brushStart({selection}) {
            console.log('brush started');
            d3.select('.saveBtnContainer').remove();
        }

        function brushEnd(event) {
            if (!event.sourceEvent) return;
      
            console.log('brush ended');
            selection = event.selection;

            // check it was not a random click
            if( selection && selection.length >= 2){

                // Check if started within a already annotated area
                // if so push to the nearest non-annotated right/left side
                // TODO Fix snapping case where 2 events are continous 
                let sx = selection.map(xScale.invert);
                let newStart = new Date (sx[0]),
                    newEnd = new Date (sx[1]),
                    flag = false;

                allEvents.forEach( e => {
                    if( sx[0] <= e.start && sx[1] >= e.start && flag == false){
                       newEnd = e.start;
                       flag = true;
                    }else if( sx[0] >= e.start && sx[0] <= e.end && flag == false){
                       newStart = e.end;
                       flag = true;
                    }
                });

                sx = [newStart,newEnd];
                if( flag == true){
                    brushContainer.call(brush.move,sx.map(xScale))
                }
                
                console.log(sx);

                // Create a button to save event
                d3.select('div#container svg')
                  .append('g')
                  .attr('class','saveBtnContainer')
                  .style('cursor','pointer')
                  .on('click', () => { openDialogue(sx); })
                  // Show the save button aligned to the selection
                  .attr('transform', 'translate(' +(xScale(sx[0]) + (xScale(sx[1])-xScale(sx[0]))/2 - 50)+','+svgMarginTop+')')
                
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

        function clearBrushSelection(){
            d3.select('.saveBtnContainer').remove();
            svgGroup.selectAll('rect').style("opacity", '1');
        }

        function brushing({selection}) {
            console.log('brush hapenning')

            if (selection === null) {
               clearBrushSelection();
            } else {
              const sx = selection.map(xScale.invert);

              d3.selectAll('.dataPoints rect').style("opacity", d => { 
                return sx[0] <= d.time && d.time <= sx[1] ? "1" : '0.2'; });
            }
        }

        function openDialogue(selection){
            d3.select('#dialogueBox h4').html('Create Event')
            evnt.id = ids++;

            // TODO: add more acccurate time mapping based on the bars not the brushing
            evnt.start = selection[0] //xScale.invert(selection[0]);
            evnt.end = selection[1] //xScale.invert(selection[1]);

            duration = evnt.end.getTime() - evnt.start.getTime();
            durationInHours = (duration / 60000).toFixed(0)/60;
            durationInMinutes = (duration/60000) % 60;
            evnt.duration = durationInHours.toFixed(0) + " hours and "+ durationInMinutes.toFixed(0) +" minutes";

            // TODO: add always on function
            evnt.consumption = d3.sum(response.readings.filter(d => {
                return new Date(d.time) >= evnt.start && new Date(d.time) < evnt.end;
            }), function (d) {return d.value;}) // - always_on;

            d3.select("#dialogueBox")
              .style('left', () => { return (window.innerWidth/2 - 150 )+ "px";})
              .style('display','block');

            printDate = d3.timeFormat('%b %d %H:%M');
            d3.select('#dialogueBox #evntDuration').html(evnt.duration);
            d3.select('#dialogueBox #evntStart').html(printDate(evnt.start));
            d3.select('#dialogueBox #evntEnd').html(printDate(evnt.end));
            d3.select('#dialogueBox #evntConsumption').html(evnt.consumption.toFixed(1)+" KW");
        
            d3.select("#iconField").empty();
            d3.select("#iconField")
                .selectAll('img')
                .data(event_types)
                .join('img')
                .attr('class', d => { return 'icon ' + d})
                .attr('src', d => { return '/static/imgs/event_icons/' + d + '.png'})
                .attr('alt', d => {return d})          
                .attr('title', d => {return d})
                .on('click', d => {
                   evnt.type = d.target['__data__'];
                   d3.selectAll('#iconField img').classed('selected',false)
                   d3.select('.'+evnt.type).classed('selected',true)
                })
        }

        function resetDialogue(){
           evnt = {
            'start' :'',
            'end'   : '',
            'duration': 0,
            'consumption': 0,
            'id':'',
            'type':'',
            'notes':''
           }

            d3.select('#dialogueBox #evntDuration').html(evnt.duration);
            d3.select('#dialogueBox #evntStart').html(printDate(new Date(evnt.start)));
            d3.select('#dialogueBox #evntEnd').html(printDate(new Date(evnt.end)));
            d3.select('#dialogueBox #evntConsumption').html(+(evnt.consumption).toFixed(1)+" KW");
            document.getElementById('notes').value = evnt.notes;
            d3.selectAll("#iconField img").classed('selected',false)
        }

        d3.select('#savebtnDialogue').on('click', () =>{
            evnt.notes = document.getElementById('notes').value;

            // TODO CHANGE THIS TO MORE ROBUST WAY!
            if( d3.select('#dialogueBox h4').html() === 'Create Event'){
                // If new Push this events to a list of all
                allEvents.push(evnt);
                updateAnnotationBar(evnt);
            }else{
                editAnnotationBar(evnt)
            }
            console.log(allEvents);

            // Highlight the annotated area
            d3.selectAll('.dataPoints rect').filter( d => { 
                return evnt.start <= d.time && d.time <= evnt.end;
            }).style("fill", 'steelblue');


            // Reset and close the dialogue
            resetDialogue();
            closeDialogue();

            // Clear the previous brushing 
            // clearBrushSelection();
            // brushContainer.call(brush.move,null);
        });

        function closeDialogue() {
            d3.select("#dialogueBox")
              .style('display','none');

            clearBrushSelection();
            brushContainer.call(brush.move,null);
        }

        d3.select('#closebtnDialogue').on('click', closeDialogue);

        function editEvent(e,id){
            if (!e.srcElement) return;
            console.log('edit event')

            d3.select('#dialogueBox h4').html('Edit event')

            evnt = allEvents.filter(d => { return (d.id == id) })[0]

            d3.select("#dialogueBox")
              .style('left', () => { return (window.innerWidth/2 - 150 )+ "px";})
              .style('display','block');

            printDate = d3.timeFormat('%b %d %H:%M');
            d3.select('#dialogueBox #evntDuration').html(evnt.duration);
            d3.select('#dialogueBox #evntStart').html(printDate(new Date(evnt.start)));
            d3.select('#dialogueBox #evntEnd').html(printDate(new Date(evnt.end)));
            d3.select('#dialogueBox #evntConsumption').html(+(evnt.consumption).toFixed(1)+" KW");
            document.getElementById('notes').value = evnt.notes;

            d3.select("#iconField").empty();
            d3.select("#iconField")
                .selectAll('img')
                .data(event_types)
                .join('img')
                .attr('class', d => { return 'icon ' + d})
                .attr('src', d => { return '/static/imgs/event_icons/' + d + '.png'})
                .attr('alt', d => {return d})          
                .attr('title', d => {return d})
                .classed('selected', d => { return d == evnt.type })
                .on('click', d => {
                   evnt.type = d.target['__data__'];
                   d3.selectAll('#iconField img').classed('selected',false)
                   d3.select('.'+evnt.type).classed('selected',true)
                })
        }

        function editAnnotationBar(event){
            dd = d3.select(".annotationBar").filter(d => { return (d == event.id) })

            dd.select('image').attr("xlink:href", '/static/imgs/event_icons/' + event.type + '_black.png')
            dd.select('text').text(event.type)
        }

        function updateAnnotationBar(event){

            const anntLine = d3.line()
                         .x(d => xScale(d))
                         .y(svgMarginTop-30);

            anntContainer = d3.select("div#container svg")
              .append('g').attr('class','annotationBar')
              .datum(event.id)

            anntContainer
                .append('path')
                .datum([event.start, event.end])
                .attr('d', anntLine)
                .attr('stroke-width','2px')

            anntContainer
                .append('text')
                .attr('font-size','15px')
                .attr('x', xScale(event.start) + 20)
                .attr('y',svgMarginTop-35)
                .text(event.type)

            anntContainer
                .append('image')
                .attr("xlink:href", '/static/imgs/event_icons/' + event.type + '_black.png')
                .attr("x", xScale(event.start) ).attr("y", svgMarginTop-50)
                .attr("width", 16).attr("height", 16)
                .on('click', (e) => {editEvent(e,event.id)})

            blockC = anntContainer
                     .append('g').attr('class','blocksContainer')

            const amnt = (evnt.consumption/consumptionUnit).toFixed(0)
            array = [];
            for (var i = 0; i <amnt; i++) {
                array.push(1);
            }

            blockC.append('text').text(evnt.consumption.toFixed(2)+"KW")
                  .attr('x', xScale(event.start))
                  .attr('y',svgMarginTop-10)

            y = -1;j=-1;
            blockC.selectAll('rect')
                  .data(array, d => {return d})
                  .join('rect')
                  .attr('width',15)
                  .attr('height',15)
                  .attr('transform', (d,i) => { 

                    if( j*20 > svgMarginLeft*2){ y++;j=0;}
                    else{ j++; }
                    x = xScale(event.start) + j*20;
                    return 'translate('+x+','+(y*20+svgMarginTop+15)+')';
                  })
                  .style('fill','#ff9620')
        }

    }

    d3.select('#saveCSV').on('click', exportCSV);

    function exportCSV(){
        let csvContent = "data:text/csv;charset=utf-8," 
        
        // save label names
        pp = '';
        for (const key in allEvents[0]) {
            pp += key + ',';
        }
        pp = pp.slice(0, -1); 
        csvContent += pp + "\n";

        // save data 
        allEvents.forEach( (e,i) => {
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

    function addSunriseSunset(){

      d3.json('http://api.sunrise-sunset.org/json?lat=51.509865&lng=-0.118092&date=today&formatted=0')
      .then(function (data) {
        console.log(data);

        d3.select('div#container svg')
          .append('g')
          .attr('class','backgroundData');

        sunset = new Date(data.results.sunset);
        sunrise = new Date(data.results.sunrise);

        flag = false;
        pathD = '';
        loc = '';
        d3.selectAll('.backgroundData path').remove()

        d3.selectAll('.axis .tick').each(d => {
            tmp = new Date(d);

            // first time we find a 'night'
            if( (tmp.getHours() < sunrise.getHours() || tmp.getHours() > sunset.getHours()) && flag==false ){
                pathD += 'M'+xScale(tmp)+','+svgHeight; 
                flag = true;
                loc = tmp;
            }

            // first time we find a 'day' after a 'night' -> draw it
            if(tmp.getHours() >= sunrise.getHours() && tmp.getHours() < sunset.getHours() && flag==true){
                pathD += ' L'+xScale(tmp)+','+svgHeight+' L'+xScale(tmp)+','+0+' L'+xScale(loc)+','+0+' Z';
                d3.select('.backgroundData')
                 .append('path')
                 .attr('d', pathD)
                 .style('opacity',0.1)
                 .style('fill','gray')

                d3.select('.backgroundData')
                  .append('text')
                  .text('night')
                  .attr('x', xScale(loc) + 10)
                  .attr('y', 20)
                  .style('font-style','italic')
                  .style('font-size','14px')
                  .attr('fill','gray')


                pathD = '';
                loc = '';
                flag = false;
            }
        })
        

      })
    }

});