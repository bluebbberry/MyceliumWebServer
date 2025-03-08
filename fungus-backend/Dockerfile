FROM python:3.8-slim-buster

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

# Copy the source code after installing dependencies to make use of caching
COPY src src/
COPY .env .env
COPY .. .

WORKDIR /src

CMD [ "python", "./main.py" ]
