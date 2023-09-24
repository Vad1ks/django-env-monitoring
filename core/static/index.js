var map = L.map('map').setView([50.441764, 30.521178], 11).on('click', onMapClick);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var popup = L.popup();

function onMapClick(e) {
    const geocoder = new google.maps.Geocoder();
    let geocodedAddress = geocoder.geocode({location: e.latlng})
        .then((response) => {
            geocodedAddress = response.results[0].formatted_address
            let customPopUp = `<b><p id="title">
                             Хочете додати новий об'єкт за цими координатами? 
                             <p id="latlng">${e.latlng.lat}, ${e.latlng.lng}</p> <br>
                             <p id="geocodedAddress">${geocodedAddress}</p>
                             <br>
                             <button id='create-object-button' onclick="openCreateObjectForm()"> Створити об'єкт</button>`
            popup
                .setLatLng(e.latlng)
                .setContent(customPopUp)
                .openOn(map);
        })
        .catch((e) => window.alert("Geocoder failed due to: " + e))
}

function createObjectFormInit() {
    const form = document.getElementById("create-object-form")
    let tabs_container = document.createElement("div")
    tabs_container.id = "tabs-container"
    form.appendChild(tabs_container)
    uniqueSystemsPresent.forEach(system => {
        let tab_title = systems[system]
        let tab_id = `tab${system.charAt(0).toUpperCase() + system.slice(1)}`
        let new_tab = document.createElement("div")
        new_tab.id = tab_id
        new_tab.className = "tab"
        new_tab.setAttribute("onclick", `selectTab(\'${tab_id}\')`)
        new_tab.innerHTML = tab_title
        tabs_container.appendChild(new_tab)
    })
    let tabs_content_container = document.createElement("div")
    tabs_content_container.id = "tabs-content-container"
    form.appendChild(tabs_content_container)
    uniqueSystemsPresent.forEach(system => {
            let tab_id = `tab${system.charAt(0).toUpperCase() + system.slice(1)}Content`
            let new_tab_content_item = document.createElement("div")
            new_tab_content_item.id = tab_id
            new_tab_content_item.classList.add("tabContent")

            let placeholder = translation_and_unit["date"].split(',')[0]
            let date_input = document.createElement("input")
            let date_label = document.createElement("label")
            date_label.innerHTML = "Дата збору:"
            date_label.setAttribute("for", `date-input`);
            date_input.id = `date-input`
            date_input.type = "datetime-local"
            date_input.className = "data-input"
            date_input.placeholder = placeholder
            new_tab_content_item.appendChild(date_label)
            new_tab_content_item.appendChild(date_input)
            systems_fields[system].forEach(field => {
                if (field === "date") {
                    return
                }
                let placeholder = translation_and_unit[field].split(',')[0]
                let input = document.createElement("input")
                input.id = `${field}-input`
                input.className = "data-input"
                input.placeholder = placeholder
                input.type = "number"
                input.step = "any"
                new_tab_content_item.appendChild(input)
            })
            tabs_content_container.appendChild(new_tab_content_item)
        }
    )
    let buttonContainer = document.createElement("div")
    buttonContainer.className = "button-container"

    let submitButton = document.createElement("button")
    submitButton.id = "submitButton"
    submitButton.innerHTML = "Підтвердити"
    submitButton.setAttribute("onclick", `submit()`)

    let closeButton = document.createElement("button")
    closeButton.id = "closeButton"
    closeButton.innerHTML = "Відміна"
    closeButton.onclick = close

    form.appendChild(tabs_container)
    form.appendChild(buttonContainer)
    buttonContainer.appendChild(submitButton)
    buttonContainer.appendChild(closeButton)
}

function openCreateObjectForm() {
    const form = document.getElementById("create-object-form")
    form.classList.remove("not-displayed")
    form.style.display = "flex"
}

async function submit() {
    let object_title = document.getElementById("title-input")
    let latlng = document.getElementById("latlng").innerHTML
    let latitude = latlng.split(",")[0]
    let longitude = latlng.split(",")[1].trim()
    let geocodedAddress = document.getElementById("geocodedAddress").innerHTML
    if (object_title.value === "" || object_title.value === undefined) {
        alert("Введіть ім'я об'єкту!");
        return
    }
    if (window.getComputedStyle(object_title).borderColor === 'rgb(255, 0, 0)') {
        alert("Введіть коректні дані для поля " + object_title.placeholder + "\nМінімальна довжина - 6 символів")
        return
    }
    let body1 =
        {
            "title": object_title.value,
            "latitude": latitude,
            "longitude": longitude,
            "address": geocodedAddress,
            "data": {}
        }

    let tabs = [...document.getElementsByClassName("tabContent")]
    tabs.forEach(tab => {
        let tab_title = tab.id.match("[A-Z][a-z]*")[0].toLowerCase();
        let tab_inputs = [...tab.childNodes]
        tab_inputs.shift()
        let system_data = {}
        system_data[tab_title] = {}
        tab_inputs.every(input => {
            if (window.getComputedStyle(input).borderColor === 'rgb(255, 0, 0)') {
                alert("Введіть коректні дані для поля " + input.placeholder)
                return false
            }
            let value = input.value
            if (value === "") {
                return true
            }
            let key = input.id.split("-")[0]
            system_data[tab_title][key] = value
            return true
        })
        if (Object.keys(system_data[tab_title]).length !== 0) {
            Object.assign(body1["data"], system_data)
        }
    })
    console.log(JSON.stringify(body1))
    if (Object.keys(body1.data).length === 0) {
        alert("Введіть дані про об'єкт")
        return
    }
    for (let system in body1.data) {
        if (body1.data[system]["date"] === undefined) {
            alert("Введіть дату збору для " + systems[system])
            return
        } else if (Object.keys(body1.data[system]).length === 1) {
            alert("Введіть дані для " + systems[system])
            return
        }
    }
    body1 = JSON.stringify(body1);
    const response = await fetch('/create-object',
        {
            method: 'POST',
            headers: {
                "Accept": 'application.json',
                'Content-Type': 'application/json'
            },
            body: body1,
            cache: 'default'
        });
    const json_data = await response.json();
    if (response.status === 200) {
        alert("Об'єкт був успішно доданий.\n Оновіть сторінку щоб побачити його на карті")
        close()
    }
    console.log(JSON.stringify(json_data));
}

function close() {
    const form = document.getElementById("create-object-form")
    const popUpCloseBtn = document.getElementsByClassName("leaflet-popup-close-button")
    const inputs = [...document.getElementsByTagName("input")]
    form.style.display = "none"
    popUpCloseBtn[0].click()
    inputs.forEach(input => {
        input.value = ""
    })
    const active_tab = document.getElementsByClassName("tab active")[0]
    active_tab.classList.remove("active")
    const opened_tab_content = document.getElementsByClassName("tabContent activeTab")[0]
    opened_tab_content.style.display = "none"
}

const translation_and_unit = {
    "date": "Дата збору,",
    "PM1": "PM1, мкг/м³",
    "PM25": "PM2.5, мкг/м³",
    "PM10": "PM10, мкг/м³",
    "atmospheric_pressure": "Атмосферний тиск, гПа",
    "temperature": "Температура, °C",
    "humidity": "Відносна вологість, %",
    "gamma": "γ-Радіація, нЗв/год",
    "turbidity": "Каламутність, мг/м³",
    "coloration": "Забарвленiсть, градусів",
    "smell20": "Запах при 20°C, балів",
    "smell60": "Запах при 60°C, балів",
    "taste": "Смак та присмак,",
    "ph": "рН -- водневий nоказник,",
    "rigidity": "Загальна жорсткість, ммоль/дм³",
    "manganese": "Марганець, мг/дм³",
    "iron": "Залізо загальне, мг/дм³",
    "ammonium": "Амоній, мг/дм³",
    "dry_residue": "Сухий залишок,",
    "permanganate_oxidizability": "Перманганатна окиснюваність,",
    "nitrites": "Нітрити,",
    "year": "Рік,",
    "n2o": "Оксид азоту,",
    "ammonia": "Аміак,",
    "benzol": "Бензол,",
    "carbon_dioxide": "Вуглецю діоксид,",
    "dimethylamine": "Діметиламін,",
    "sulfur": "Діоксид та інші сполуки сірки,",
    "methane": "Метан,",
    "nmloc": "Неметанові леткі органічні сполуки,",
    "carbon_oxide": "Оксид вуглецю,",
    "nitrous_oxide": "Оксид азоту,",
    "microparticles": "Речовини у вигляді суспендованих твердих частинок,",
    "h2s": "Сірководень,",
    "phenol": "Фенол,",
    "total": "Загальна кількість,",
    "covid": "Хворі на Covid-19,",
    "chronic_disease": "Хронічні захворювання,",
    "disabled": "Інваліди,",
    "export": "Експорт, тис. грн",
    "import": "Імпорт, тис. грн",
    "salary": "Зарплати, тис. грн",
    "square": "Площа, кв.км"

}

const systems = {
    "air": "Повітря",
    "radiation": "Радіація",
    "water": "Якість води",
    "emissions": "Викиди",
    "employees": "Здоров'я співробітників",
    "economy": "Економіка"
}


function createTabsContent(ecoObject, popUp) {
    console.log(ecoObject.data)
    popUp = popUp + `<div id="content-placeholder">Виберіть підсистему щоб подивитись інформацію про неї</div>`
    for (const [system, value] of Object.entries(ecoObject.data)) {
        let tab_id = `"tab${system.charAt(0).toUpperCase() + system.slice(1)}Content"`
        let scores = integral_scores.filter(function (obj) {
            return obj._id === ecoObject._id
        })
        console.log("filtered scores:", scores)
        let scores_array = scores[0].data[system]
        let score = scores_array[0]
        let description = scores_array[1]
        console.log("description: "+ description)
        let content = `<div id='integralScore'>${score} ${description}</div>`

        Object.entries(value).forEach(entry => {
            let entry_records_array = Object.values(entry)
            entry_records_array.shift()
            console.log(entry_records_array)
            for (let record of entry_records_array) {
                let date = record.date?.split("T")[0] + " " + record.date?.split("T")[1]
                if (date !== undefined) {
                    let tau = translation_and_unit["date"]?.split(",")
                    let key_translation = tau[0]
                    let key_unit = tau[1]
                    content = content + `${key_translation}: ${date} ${key_unit}<br>`
                }
                for (const [key, value1] of Object.entries(record)) {
                    if (key === 'date') {
                        continue
                    }
                    let tau = translation_and_unit[key]?.split(",")
                    if (tau !== undefined) {
                        let key_translation = tau[0]
                        let key_unit = tau[1]
                        content = content + `${key_translation}: ${value1} ${key_unit}<br>`
                    } else {
                        content = content + `${key}: ${value1} <br>`
                    }
                }
            }
            content += "<hr>"
        })
        content += `<button id="create-chart-button" onclick="drawChart()">Побудувати графік</button>`
        popUp = popUp + `<div id=${tab_id} class="tabContent">${content}</div>`
    }
    return popUp
}

function createTabs(ecoObject, popUp) {
    popUp = popUp + `<div id="tabs-container">`

    for (const key of Object.keys(ecoObject.data)) {
        let tab_title = systems[key]
        let tab_id = `tab${key.charAt(0).toUpperCase() + key.slice(1)}`
        popUp = popUp + `<div id=${tab_id} class="tab" onclick="selectTab(\'${tab_id}\')">${tab_title}</div>`
        systemsPresent.push(key)
    }
    popUp = popUp + `</div>`

    popUp = popUp + `<div id="tabs-content-container">`
    popUp = createTabsContent(ecoObject, popUp)
    return popUp + `</div>`
}

function selectTab(tab_id) {
    let tabs_content = document.getElementById("tabs-content-container").childNodes
    let tabs = document.getElementById("tabs-container").childNodes
    tabs_content.forEach(tab => {
        tab.style.display = "none"
        tab.className = tab.className.replace(" activeTab", "");
    })
    tabs.forEach(tab => {
        tab.className = tab.className.replace(" active", "");
    })

    document.getElementById(tab_id).className += " active"
    document.getElementById(tab_id + "Content").style.display = "block"
    document.getElementById(tab_id + "Content").className += " activeTab"
}

let ecoObjects = JSON.parse(document.getElementById('ecoObjects_json').textContent)
console.log(ecoObjects)
let systemsPresent = []
let systems_fields = JSON.parse(document.getElementById('systems_fields_json').textContent)
console.log(systems_fields)
let integral_scores = JSON.parse(document.getElementById('integral_scores_json').textContent)
console.log(integral_scores)
let layerGroup = L.layerGroup().addTo(map);

function setMarkers(ecoObjects) {
    ecoObjects.forEach(ecoObject => {
        let customPopUp = `<b><p id="title">
                             ${ecoObject.title} <br>
                             <p id="address">${ecoObject.address}</p> <br><br>
                             </p>
                             <br>
                             <div id='objectData'>`

        customPopUp = createTabs(ecoObject, customPopUp)
        customPopUp = customPopUp + '</div>'

        L.marker([ecoObject.latitude, ecoObject.longitude])
            .bindPopup(customPopUp)
            .addTo(layerGroup)
    })
}

function clearMap() {
    layerGroup.clearLayers();
}

function filterclick(filter_id) {
    let filter_buttons = [...document.getElementsByClassName("system-filter")]

    if (!document.getElementById(filter_id).className.includes(" active")) {
        filter_buttons.forEach(tab => {
            tab.className = tab.className.replace(" active", "");
        })
        document.getElementById(filter_id).className += " active"
        console.log("Trying to clear map")
        clearMap();
        console.log("Trying to filter markers")
        console.log("Markers: " + ecoObjects.filter(function (obj) {
            let system_to_filter = filter_id.split("-")[0]
            return obj.data[system_to_filter] !== undefined
        }))
        setMarkers(ecoObjects.filter(function (obj) {
            let system_to_filter = filter_id.split("-")[0]
            return obj.data[system_to_filter] !== undefined
        }));
    } else {
        document.getElementById(filter_id).className = document.getElementById(filter_id).className.replace(" active", "")
        setMarkers(ecoObjects)
    }
}

function createFilters() {
        console.log("Unique Systems: " + uniqueSystemsPresent)
    uniqueSystemsPresent.forEach(system => {
        const filter_container = document.getElementById("filter-container")
        let system_div = document.createElement("div")
        let div_id = `${system}-filter`
        system_div.id = div_id
        system_div.className = "system-filter"
        system_div.innerHTML = systems[system]
        system_div.setAttribute("onclick", `filterclick(\'${div_id}\')`)
        filter_container.appendChild(system_div)
    })
}


async function drawChart() {
    if (!document.getElementById("chart-container")) {
        let div = document.createElement("div")
        let map_container = document.getElementById("map-container")
        let figure = document.createElement("figure")
        let figure_container = document.createElement("div")

        div.id = "chart-container"

        figure_container.style.width = "-webkit-fill-available"

        map_container.appendChild(figure_container)
        figure_container.appendChild(figure)
        figure.appendChild(div)
        let close_button = document.createElement("button")
        close_button.onclick = (e=>{
            let figure_container = document.querySelector("div[style='width: -webkit-fill-available;']")
            figure_container.remove();
            chart.destroy();
        })
        close_button.id = "close-chart-button"
        close_button.innerHTML = "Закрити графік"
        figure_container.appendChild(close_button)
    }
    let address = document.getElementById("address").innerHTML
    let active_tab = document.getElementsByClassName("tab active")[0]
    let system = active_tab.id.match("[A-Z][a-z]*")[0].toLowerCase();
    const response = await fetch(`/chart-data?address=${address}&system=${system}`);
    const json_data = await response.json();
    console.log(json_data)
    let range_desc_x = json_data.filter(obj => {
                    return obj.name === 'date'
                })[0].data
    range_desc_x = range_desc_x.map((date)=>{ return date.replace("T"," ")})
    json_data.forEach(obj=>{
        obj.name = translation_and_unit[obj.name]
    })
    let json_data_without_date = json_data.filter(obj=>{
        return obj.name !== 'date'
    })
    let chart = Highcharts.chart('chart-container', {
        chart: {
            type: 'line'
        },
        xAxis: {
            categories: range_desc_x
            },
            yAxis: {
                type: 'logarithmic',
            },
            title: {
                text: `${address}: ${systems[system]}`,
                align: 'left'
            },
            series: json_data_without_date
        })
    document.getElementById("chart-container").style.overflow = ""
}

    setMarkers(ecoObjects);
    let uniqueSystemsPresent = [...new Set(systemsPresent)]
    createFilters();
    createObjectFormInit();

// drawChart();