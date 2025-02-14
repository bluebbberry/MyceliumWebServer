FROM python:3.8-slim-buster

COPY src src
COPY .env .env
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY . .

WORKDIR /src

CMD [ "python", "./main.py" ]
