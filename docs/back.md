## Задача

Добавить POST к существующему эндпоинту /api/version/ для загрузки
новой версии .exe клиента (ZIP файл) с заменой предыдущей версии.

Стек: Django REST Framework.

---

## Текущее состояние (не трогать сам принцип GET)

GET /api/version/ — публичный, без авторизации, возвращает:
{
"version": "1.0.0",
"zip_url": "https://app.nurcrm.kg/downloads/NurCRM-1.0.0.zip",
"release_notes": "Первый релиз"
}

Раньше данные хранились в settings.py (CLIENT_VERSION и т.д.) —
это больше не подходит, так как POST должен обновлять данные
без перезапуска сервера. Переносим хранение в БД.

---

## Шаг 1 — Модель

Создать модель (в приложении cafe или отдельном core/releases):

# models.py

from django.db import models

class ClientRelease(models.Model):
version = models.CharField(max_length=50)
zip_file = models.FileField(upload_to='client-releases/')
release_notes = models.TextField(blank=True, default='')
created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"NurCRM {self.version}"

Создать и применить миграцию:
python manage.py makemigrations
python manage.py migrate

---

## Шаг 2 — Сериализатор

# serializers.py

from rest_framework import serializers
from .models import ClientRelease

class ClientReleaseSerializer(serializers.ModelSerializer):
zip_url = serializers.SerializerMethodField()

    class Meta:
        model = ClientRelease
        fields = ['version', 'zip_url', 'release_notes']

    def get_zip_url(self, obj):
        request = self.context.get('request')
        if obj.zip_file and request:
            return request.build_absolute_uri(obj.zip_file.url)
        return obj.zip_file.url if obj.zip_file else None

class ClientReleaseUploadSerializer(serializers.ModelSerializer):
class Meta:
model = ClientRelease
fields = ['version', 'zip_file', 'release_notes']

---

## Шаг 3 — View

# views.py

import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from .models import ClientRelease
from .serializers import ClientReleaseSerializer, ClientReleaseUploadSerializer

class ClientVersionView(APIView):
"""
GET - публичный, отдаёт последнюю версию (без авторизации)
POST - только для админов/owner, загружает новую версию,
заменяет zip-файл предыдущей версии
"""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminUser()]
        return [AllowAny()]

    def get_parsers(self):
        if self.request.method == 'POST':
            return [MultiPartParser(), FormParser()]
        return super().get_parsers()

    def get(self, request):
        latest = ClientRelease.objects.first()  # ordering = -created_at
        if not latest:
            return Response({
                "version": "0.0.0",
                "zip_url": None,
                "release_notes": "Нет доступных релизов"
            })

        serializer = ClientReleaseSerializer(latest, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = ClientReleaseUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Удалить файл предыдущей версии (если есть) чтобы не копились ZIP'ы
        previous = ClientRelease.objects.first()
        if previous and previous.zip_file:
            old_path = previous.zip_file.path
            if os.path.isfile(old_path):
                os.remove(old_path)
            previous.delete()  # удаляем старую запись из БД

        instance = serializer.save()

        out = ClientReleaseSerializer(instance, context={'request': request})
        return Response(out.data, status=201)

---

## Шаг 4 — URL (без изменений в маршруте)

# urls.py

path('version/', ClientVersionView.as_view()),

---

## Шаг 5 — Настройка MEDIA для отдачи zip-файлов

Убедиться что в settings.py настроено:

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

И в основном urls.py (если ещё не добавлено):

from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

Файл будет доступен по адресу вида:
https://app.nurcrm.kg/media/client-releases/NurCRM-1.0.1.zip

---

## Шаг 6 — Nginx (если MEDIA не отдаётся через Django в production)

В конфиге Nginx добавить (если ещё нет):

location /media/ {
alias /path/to/project/media/;
}

---

## Требования к безопасности

- POST доступен ТОЛЬКО для is_staff / is_superuser (IsAdminUser)
- GET остаётся публичным без авторизации
- При загрузке новой версии старый ZIP физически удаляется с диска
  (не остаётся мусора)
- Ограничить размер загружаемого файла (на уровне Nginx
  client_max_body_size, например 50M)

---

## Как загружать новую версию (для админа)

curl -X POST https://app.nurcrm.kg/api/version/ \
 -H "Authorization: Bearer <admin_token>" \
 -F "version=1.0.1" \
 -F "release_notes=Исправлена синхронизация" \
 -F "file=@NurCRM-1.0.1.zip;filename=zip_file"

Либо через Django Admin (зарегистрировать модель ClientRelease
в admin.py для удобной загрузки через UI):

# admin.py

from django.contrib import admin
from .models import ClientRelease

@admin.register(ClientRelease)
class ClientReleaseAdmin(admin.ModelAdmin):
list_display = ['version', 'created_at']

---

## Что НЕ менять

- Контракт GET /api/version/ — формат ответа остаётся прежним
  (version, zip_url, release_notes), exe-клиент ничего не меняет
- Остальные эндпоинты офлайн-режима (offline-snapshot, offline-sync)
