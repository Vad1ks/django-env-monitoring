import json

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import pandas as pd
import pymongo
from passwords import MongoDB


def integral_score_air(record):
    pm = record.get("PM25")
    if pm <= 12:
        AQI = 50 / 12 * pm
        description = "Добрий"
    elif pm <= 35.4:
        AQI = ((100 - 51) / (35.4 - 12.1)) * pm
        description = "Задовільний"
    elif pm <= 55.4:
        AQI = ((150 - 101) / (55.4 - 35.5)) * pm
        description = "Шкідливий для групи ризику"
    elif pm <= 150.4:
        AQI = ((200 - 151) / (150.4 - 55.5)) * pm
        description = "Шкідливий"
    elif pm <= 250.4:
        AQI = ((300 - 201) / (250.4 - 150.5)) * pm
        description = "Дуже шкідливий"
    else:
        AQI = ((500 - 301) / (500.4 - 350.5)) * pm
        description = "Небезпечний"

    return f"AQI {AQI:.0f}", description


def integral_score_water(record):
    gdks = {
        "manganese": 0.05,
        "iron": 0.2,
        "ammonium": 1.2,
        "nitrites": 0.5,
    }
    concentrations = []
    for key in record.keys():
        try:
            gdk = gdks[key]
            concentrations.append(record[key] / gdk)
        except KeyError:
            continue
    concentrations_sum = sum(concentrations)

    description = "Вода в нормі" if concentrations_sum <= 1 else "Вода не придатна для пиття"

    return f"Сума концентрацій - {sum(concentrations):.2}", description


def integral_score_radiation(record):
    gamma = record.get("gamma")
    if gamma < 200:
        description = "звичайний рівень радіаційного фону"
    elif gamma < 300:
        description = "нормальний радіаційний фон"
    elif gamma <= 1200:
        description = "підвищений радіаційний фон"
    else:
        description = "небезпечний радіаційний фон"

    return gamma, description


def integral_score_emissions(record):
    koefs = {
        "n2o": 0.8,
        "ammonia": 0.4,
        "benzol": 1,
        "dimethylamine": 0.7,
        "sulfur": 0.8,
        "iron": 0.7,
        "manganese": 1,
        "nmloc": 0.9,
        "h2s": 0.8,
        "phenol": 1
    }
    pollution_index = 0
    print(record)
    for key in record.keys():
        try:
            koef = koefs[key]
            pollution_index += record[key] * koef
            print("record[key], koef ", record[key], koef)
        except KeyError:
            continue
    pollution_index /= record.get("square")
    if pollution_index <= 0.5:
        description = "Дуже добре"
    elif pollution_index <= 0.8:
        description = "Добре"
    elif pollution_index <= 1:
        description = "Середній"
    elif pollution_index <= 1.5:
        description = "Поганий"
    else:
        description = "дуже поганий"

    return f"Індекс: {pollution_index:.2f}", description


def integral_score_economy(record):
    export_data = record.get("export")
    import_data = record.get("import")
    salary = record.get("salary")
    score = (export_data - import_data) / salary

    if score >= 2:
        economy_index = "Дуже хороший стан"
    elif score >= 1.5:
        economy_index = "Хороший стан"
    elif score >= 1:
        economy_index = "Середній стан"
    elif score >= 0.5:
        economy_index = "Поганий стан"
    else:
        economy_index = "Дуже поганий стан"

    return f"Індекс: {score:.2f}", economy_index


def integral_score_health(record):
    ignore_keys = ("date", "total")
    total = record.get("total")

    score = total
    for key in record.keys():
        if key not in ignore_keys:
            score -= record[key]

    score = score / total * 100

    if score < 40:
        description = "Дуже поганий стан"
    elif score < 60:
        description = "Поганий стан"
    elif score <= 80:
        description = "Добрий стан"
    else:
        description = "Відмінний стан"

    return f"{score:.2f}% здорових", description


username = MongoDB.USERNAME
password = MongoDB.PASSWORD
client = pymongo.MongoClient(f'mongodb+srv://{username}:{password}@sandbox.vpfnr.mongodb.net/')
dbname = client['ecolabs']
collection = dbname['objects']


def index(request):
    ecoObjects = list(collection.find({}))
    systems_objects = list(collection.find({}, {"_id": 1, "data": 1}))

    for ecoObject in ecoObjects:
        ecoObject['_id'] = str(ecoObject['_id'])

    for systems_object in systems_objects:
        systems_object['_id'] = str(systems_object['_id'])

    keys_list = [list(obj["data"].keys()) for obj in systems_objects]
    keys = list(set([item for sublist in keys_list for item in sublist]))

    systems_fields = {key: [] for key in keys}

    integral_scores = []
    functions = {
        'air': integral_score_air,
        'water': integral_score_water,
        'radiation': integral_score_radiation,
        'emissions': integral_score_emissions,
        'employees': integral_score_health,
        'economy': integral_score_economy
    }

    for i, obj in enumerate(systems_objects):
        integral_scores.append({"_id": obj.get("_id"), "data": {}})
        for key in keys:
            try:
                list_of_objects_for_system = obj.get('data')[key]
                record_to_count_from = sorted(list_of_objects_for_system, key=lambda x: x["date"], reverse=True)[0]

                score, description = functions[key](record_to_count_from)
                integral_scores[i].get("data").update({key: [score, description]})

                for obj1 in list_of_objects_for_system:
                    systems_fields[key] += list(obj1.keys())
                    systems_fields[key] = list(set(systems_fields[key]))

            except KeyError:
                continue
    print("integral scores from server: ", integral_scores)
    context = {'ecoObjects': ecoObjects, 'systems_fields': systems_fields, 'integral_scores': integral_scores}
    return render(request, 'index.html', context)


@csrf_exempt
def create_object(request):
    print(request.body.decode('utf-8'))
    request_body_dict = json.loads(request.body.decode('utf-8'))
    print(request_body_dict)

    request_body_dict["latitude"] = float(request_body_dict["latitude"])
    request_body_dict["longitude"] = float(request_body_dict["longitude"])
    data = request_body_dict.get("data")
    for system in data:
        for key in data[system]:
            try:
                data[system][key] = float(data[system][key])
            except ValueError:
                pass
    for system in data:
        data[system] = [data[system]]
    request_body_dict["data"] = data
    result = collection.insert_one(request_body_dict)

    print(result.inserted_id)
    if result.inserted_id:
        return JsonResponse(status=200, data={})
    else:
        return JsonResponse(status=500, data={"Something unexpected happened"})


@csrf_exempt
def create_chart_data(request):
    address_to_search = request.GET.get("address")
    system = request.GET.get("system")
    print(address_to_search, system)

    ecoObject = dict(collection.find_one({"address": address_to_search}))

    data = ecoObject.get("data").get(system)
    df = pd.DataFrame(data)
    res = []
    for key in list(df.keys()):
        data = {'name': key, "data": list(df.get(key))}
        res.append(data)
    print(res)
    return JsonResponse(res, safe=False)
