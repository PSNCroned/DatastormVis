#### External Dependencies ####
# node.js
# pm2
################################

import subprocess
import requests
import sys
import time
import mysqldb

from ptolemy.data import StringToken

class Main:

	path_to_nodejs_server = "/Users/elliot/Documents/DatastormVis/"
	db_host = ""
	db_user = ""
	db_pass = ""
	db_db = ""

	def startServer(self, port):
		subprocess.call("pm2 start index.js --node-args=\"" + port + "\"", cwd=self.path_to_nodejs_server, shell=True)

	def pingServer(self, port):
		try:
			r = requests.get("http://localhost:" + port + "/ping", timeout=.5)
			return True
		except:
			return False

	def sendToServer(self, port, config, data):
		try:
			r = requests.post("http://localhost:" + port + "/input", data={"context": config, "data": data}, timeout=.5)
			return True
		except:
			return False

	def fire(self):
		#starting server or sending data to it?
		action = self.action.get(0).stringValue()

		#port that node.js server is running on (String)
		port = self.port.get(0).stringValue()

		#Check input type
		if action == "start":
			#Start server
			self.startServer(port)

			#Wait one second for server to start
			time.sleep(1)

			#Check if node.js server is successfully running on port
			if self.pingServer(port):
				self.output.broadcast(StringToken("Node.js server running on port " + port))
			else:
				self.output.broadcast(StringToken("Unable to connect to node.js server on port " + port))

			return

		elif action == "data":
			#a JSON object (as a String) with resolution and other metadata
			config = self.config.get(0).stringValue()

			#Get data from database
			conn = mysqldb.connect(host=self.db_host, user=self.db_user, passwd=self.db_pass, db=self.db_db)
			cursor = conn.cursor()
			
			cursor.execute("SELECT * FROM data WHERE simId = " + config.simId)
			data = cursor.fetchone()
			
			conn.close()

			#Send the config and data to the nodejs server with the specified port
			if self.sendToServer(port, config, data):
				self.output.broadcast(StringToken("Data sent to server"))
			else:
				self.output.broadcast(StringToken("Error sending data to server"))

			return
