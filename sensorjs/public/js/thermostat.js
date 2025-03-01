document.addEventListener("DOMContentLoaded", async function() { 
    const DateTime = luxon.DateTime

    const urlParams = new URLSearchParams(window.location.search);

    // use d3 to get /thermostat_day_profiles
    const day_profiles = await d3.json('/thermostat_day_profiles');
    console.log('day_profiles:', day_profiles);

    const active_day_profile = await d3.json('/current_day_profile');
    console.log('active_day_profile:', active_day_profile);

    // select the dom element with id="day_profile_group"
    // using browser method
    const day_profile_group = document.getElementById('day_profile_group');

    // iterate over the day_profiles
    for (const dp of day_profiles) {
        console.log('dp:', dp.description);
        let html = `<input type="radio" class="btn-check" name="btnradio${dp['id']}" id="btnradio${dp['id']}" autocomplete="off">
        <label class="btn btn-outline-primary" for="btnradio${dp['id']}">${dp['description']}</label>`;
        if (dp['id'] === active_day_profile['id']) {
            console.log('dp.id === active_day_profile.id:', dp['id'], active_day_profile['id']);
            // html = html.replace('btn-outline-primary', 'btn-primary active');
            // html = html.replace('btnradio', 'btnradio active');
            html = html.replace('autocomplete="off"', 'autocomplete="off" checked');
        }
        day_profile_group.insertAdjacentHTML('beforeend', html);
    }

    d3.selectAll('.btn-check').on('change', async function() {
        console.log('this:', this);
        // uncheck all other radio buttons
        d3.selectAll('.btn-check').node().checked = false;
        d3.selectAll('.btn-check').nodes().forEach(function (d, i) { d.checked = false; })
        // check this radio button
        d3.select(this).node().checked = true;
        // get the id of the selected radio button
        const id = parseInt(d3.select(this).attr('id').replace('btnradio', ''), 10);
        console.log('id:', id);

        // activate the selected day_profile
        const post_data = {'thermostat_day_profiles_id': id};
        // make a post request with d3 to /day_profile_activations
        const response = await d3.json(`/day_profile_activations`, {
                method: 'POST', 
                headers: { "Content-Type": "application/json; charset=UTF-8" },
                'body': JSON.stringify(post_data)
        });

        console.log('response:', response);
    });

    // select the dom element with id="day_profile_group"
    // const day_profile_group = d3.select('#day_profile_group');
    // append a radio button to day_profile_group for each day_profile
    // day_profile_group
    //     .selectAll('input')
    //     .data(day_profiles).enter()
    //     .append('label')
    //         .attr('class', 'btn btn-outline-primary')
    //         .attr('for', function(d, i) {return `btnradio${i}`;})
    //         .text(function(d) {return d.description;})
    //     .insert('input')
    //         .attr('type', 'radio')
    //         .attr('class', 'btn-check')
    //         .attr('name', function(d, i) {return `btnradio${i}n`;})
    //         .attr('id', function(d, i) {return `btnradio${i}`;})
    //         .attr('autocomplete', 'off');
            // .property('checked', function(d) {
            //     console.log(`d.id: ${d.id}, active_day_profile.id: ${active_day_profile.id}, d.id === active_day_profile.id: ${d.id === active_day_profile.id}`);
            //     // if (d.id === active_day_profile.id) {
            //     //     d3.select(this).node().checked = true;
            //     // }
            //     return (d.id === active_day_profile.id);
            // });
    // d3.select(`#btnradio${active_day_profile.id}`).node().checked = true;

    // <input type="radio" class="btn-check" name="btnradio" id="btnradio2" autocomplete="off">
    // <label class="btn btn-outline-primary" for="btnradio2">Radio 2</label>

    // <input type="radio" class="btn-check" name="btnradio" id="btnradio3" autocomplete="off">
    // <label class="btn btn-outline-primary" for="btnradio3">Radio 3</label>


    console.log('urlParams:', urlParams);
});
