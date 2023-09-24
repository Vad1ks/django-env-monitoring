from django.urls import path, include
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('create-object', views.create_object),
    path('chart-data', views.create_chart_data)
]
