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

    let allEvents = [];


    // TODO fix which activities are included >>> make them activities not devices!
    event_types = ['washing_and_drying','housework','dishwasher','kettle','microwave','oven',
                    'question_mark','toaster','air_cooling','heating'];

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
            drawGraphs(response,series);
            addBrushing(response);
		});
    }

    function drawGraphs (response,series){

        let data = response.readings;
        // console.log(series.name, 'min, max', response.min, response.max);

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
            [0, svgWidth]
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
                .attr('x',-30)
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
                // .on("touchmove mousemove", function (event, d) {
                //     // console.log(event, d);
                //     const time = new Date(d.time.getTime() - tzOffset);
                //     let x = xScale(time);
                //     if (x > (svgWidth - 140)) {
                //         x -= 130;
                //     }
                //     const y = yScale(d.value) - 20;
                //     let txt = `${d3.timeFormat('%b %d %H:%M')(time)}, ${d.value.toFixed(1)}`;

                //     // let name = '';
                //     if (series.name in unitLUT) {
                //         txt = txt + ' ' + unitLUT[series.name];
                //     }
                //     // console.log(txt);
                    
                //     tooltip.selectAll("text")
                //         .data([null])
                //         .join("text")
                //         .text(txt);
                    
                //     const txt_w = tooltip.selectAll("text").node().getBBox().width;
                //     tooltip.selectAll("rect")
                //         .attr('width', txt_w + 10);

                //     tooltip
                //         .style('display', 'block')
                //         .attr("transform", `translate(${x},${y})`)
                //         .raise();
                // })
                // .on("touchend mouseleave touchcancel", function() {
                //     //console.log('mouseleave');
                //     tooltip.style('display', 'none');
                // });


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
       
            toKeep = "electricity_consumption";

            allSeries = allSeries.filter(function (d) {
                return toKeep.includes(d.measurement);
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
            'name':'',
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
            console.log('brush started')
        }

        function brushEnd({selection}) {
            console.log('brush ended');
            console.log(selection)

            // Create a button to save event
            d3.selectAll('div#container svg')
              .append('rect')
              .attr('id','saveButton')
              .attr('width',100)
              .attr('height',30)
              .style('cursor','pointer')
              .style('display','none')
              .text('SAVE')
          
            // Show the save button aligned to the selection
            if( selection && selection.length >= 2){
                d3.select('#saveButton')
                  .style('display','block')
                  .on('click', () => { openDialogue(selection); })
                  .attr('x', selection[0] + (selection[1]-selection[0])/2 - 50)
            }else{
                clearBrushSelection();
            }
        }

        function clearBrushSelection(){
            d3.select('#saveButton')
                .style('display','none');
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
            // d3.select(this).call(brushHandle, selection);
        }

        function openDialogue(selection){

            // TODO: add more acccurate time mapping based on the bars not the brushing
            evnt.start = xScale.invert(selection[0]);
            evnt.end = xScale.invert(selection[1]);

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
            'name':'',
            'type':'',
            'notes':''
           }

           document.getElementById('notes').value = '';
        }

        d3.select('#savebtnDialogue').on('click', () =>{
            evnt.notes = document.getElementById('notes').value;

            // Push this events to a list of all
            allEvents.push(evnt);
            console.log(allEvents);

            // Highlight the annotated area
            d3.selectAll('.dataPoints rect').filter( d => { 
                return evnt.start <= d.time && d.time <= evnt.end;
            }).style("fill", 'steelblue');

            updateAnnotationBar(evnt);

            // Reset and close the dialogue
            resetDialogue();
            closeDialogue();

            // Clear the previous brushing 
            clearBrushSelection();
            brushContainer.call(brush.move,null);
        });

    }

    function closeDialogue() {
        d3.select("#dialogueBox")
          .style('display','none');
    }

    d3.select('#closebtnDialogue').on('click', closeDialogue);


    function updateAnnotationBar(){

    }

});