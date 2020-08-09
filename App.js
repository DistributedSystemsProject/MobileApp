import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  Button,
  FlatList,
  Switch,
  Image,
  TouchableOpacity,
  ToastAndroid
} from 'react-native';
import BluetoothSerial from 'react-native-bluetooth-serial'

const idClient = "1234567890client";
const pwdClient = "clientpass";
var receivedId = "";
var receivedMessage = "";
var savedTicket = "";
var next = false;
var lastOperation = "";
var _ = require('lodash');

export default class App extends Component<{}> {
  constructor (props) {
    super(props)
    this.state = {
      icon: require('./src/images/locked.png'),
      isEnabled: false,
      discovering: false,
      devices: [],
      unpairedDevices: [],
      connected: "FALSE",
      buttonDisabled: true
    }
  }

  componentDidMount(){
    Promise.all([
      BluetoothSerial.isEnabled(),
      BluetoothSerial.list()
    ])
    .then((values) => {
      const [ isEnabled, devices ] = values;
      this.setState({ isEnabled, devices })
    })
    BluetoothSerial.on('bluetoothEnabled', () => {
      Promise.all([
        BluetoothSerial.isEnabled(),
        BluetoothSerial.list()
      ])
      .then((values) => {
        const [ isEnabled, devices ] = values;
        this.setState({  devices })
      })
      BluetoothSerial.on('bluetoothDisabled', () => {
         this.setState({ devices: [] })
      })
      BluetoothSerial.on('error', (err) => console.log(`Error: ${err.message}`))
    })
  }

  connect(device) {
    if (this.state.connected == "FALSE") {
      BluetoothSerial.connect(device.id)
      .then((res) => {
        console.log(`Connected to ${device.name}`);
        this.setState({ connected: "TRUE" })
      })
      .catch((err) => {
        console.log((err.message));
        ToastAndroid.show(`Unable to connect`, ToastAndroid.SHORT);
      })
      BluetoothSerial.withDelimiter('\r').then(() => {
        Promise.all([
          BluetoothSerial.isEnabled(),
          BluetoothSerial.list(),
        ]).then(values => {
          const [isEnabled, devices] = values;
        });
        BluetoothSerial.on('read', data => {
          var receivedData = data.data.trim();
          //If savedTicket is empty, we are at the first step
          if (savedTicket == "") {
            //If the length is 16, we have received the device's id
            if (receivedData.length == 16) {
              receivedId = receivedData;
              console.log("Device id: " + receivedId);
            } else {
              //Otherwise, the message
              this.setState({ buttonDisabled: false });
              receivedMessage = receivedData;
              console.log("Received message: " + receivedMessage);
              if (next == true) this.authorizeOperation(lastOperation);
            }
          } else {
            //At the second step, the client receives the response from the device
            console.log("Received response: " + receivedData);
            this.sendToServer(receivedData);
          }
        });
      });
    } else {
      ToastAndroid.show(`You are already connected`, ToastAndroid.SHORT);
    }
  }

  _renderItem(item){
    return(<TouchableOpacity onPress={() => this.connect(item.item)}>
            <View style={styles.deviceNameWrap}>
              <Text style={styles.deviceName}>{ item.item.name ? item.item.name : item.item.id }</Text>
            </View>
          </TouchableOpacity>)
  }

  toggleBluetooth(value) {
    if (value === true) {
      this.enable();
    } else {
      this.disable();
    }
  }
  enable() {
    BluetoothSerial.enable()
    .then((res) => this.setState({ isEnabled: true }))
    .catch((err) => Toast.showShortBottom(err.message))
  }
  disable() {
    //When bluetooth is disabled, ticket and icon are resetted
    savedTicket = "";
    this.setState({ icon: require('./src/images/locked.png') });
    this.setState({ connected: "FALSE" });
    this.setState({ buttonDisabled: true });
    next = false;
    BluetoothSerial.disable()
    .then((res) => this.setState({ isEnabled: false }))
    .catch((err) => Toast.showShortBottom(err.message))
  }

  discoverAvailableDevices () {
    if (this.state.discovering) {
      return false;
    } else {
      this.setState({ discovering: true })
      BluetoothSerial.discoverUnpairedDevices()
      .then((unpairedDevices) => {
        const uniqueDevices = _.uniqBy(unpairedDevices, 'id');
        console.log(uniqueDevices);
        this.setState({ unpairedDevices: uniqueDevices, discovering: false });
      })
      .catch((err) => console.log(err.message))
    }
  }

  //Unlock/lock action, according to the selected button
  toggleLocker(operation) {
    this.setState({ buttonDisabled: true });
    if (this.state.connected == "TRUE") {
      savedTicket = "";
      lastOperation = operation;
      if (!next) this.authorizeOperation(lastOperation);
      else this.nextRequest("TmV4dE9wZXJhdGlvbg==");
    } else {
      ToastAndroid.show(`You are not connected`, ToastAndroid.SHORT);
    }
  }

  //This function is triggered if the user push buttons lock/unlock, after the first time
  nextRequest(msg) {
    BluetoothSerial.write(msg)
    .then((res) => {
      ToastAndroid.show(`Sending request`, ToastAndroid.SHORT);
    })
    .catch((err) => console.log(err.message))
  }

  //The client contacts the server to be authorized
  authorizeOperation(operationType) {
    fetch('https://SERVER_ADDRESS:8888/authorize-operation', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: idClient,
        device_id: receivedId,
        client_pass: pwdClient,
        operation: operationType,
        load: receivedMessage
      })
    }).then((response) => response.json())
    .then((json) => {
      var serverResponse = json;
      savedTicket = json.ticket;
      this.sendToDevice(serverResponse.load);
    })
    .catch((error) => {
      console.error(error);
    });
  }

  //The authorized operation is sent to the device
  sendToDevice(aop){
    BluetoothSerial.write(aop)
    .then((res) => {
      ToastAndroid.show(`Operation in progress`, ToastAndroid.SHORT);
      this.setState({ buttonDisabled: false });
    })
    .catch((err) => console.log(err.message))
  }

  //The response is sent to the server, through the saved ticket
  sendToServer(receivedData) {
    fetch('https://SERVER_ADDRESS:8888/result', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ticket: savedTicket,
        load: receivedData
      })
    }).then((response) => response.json())
    .then((json) => {
      var serverResponse = json;
      savedTicket = "";
      next = true;
      console.log("Success: "+serverResponse.success);
      ToastAndroid.show(`Success`, ToastAndroid.SHORT);
      if (lastOperation=="lock") {
        this.setState({ icon: require('./src/images/locked.png') });
      } else if (lastOperation=="unlock") {
        this.setState({ icon: require('./src/images/unlocked.png') });
      }
    })
    .catch((error) => {
      console.error(error);
    });
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.mainToolbar}>
          <Text style={styles.mainToolbarTitle}>ARDUINO SECURE LOCKER</Text>
        </View>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Enable/Disable Bluetooth</Text>
          <View style={styles.toolbarButton}>
            <Switch
              value={this.state.isEnabled}
              onValueChange={(val) => this.toggleBluetooth(val)}
            />
          </View>
        </View>
        <Button
          onPress={this.discoverAvailableDevices.bind(this)}
          title="Rescan Devices"
        />
        <FlatList
          style={{flex:1}}
          data={this.state.devices}
          keyExtractor={item => item.id}
          renderItem={(item) => this._renderItem(item)}
        />
        <Text style={styles.dynamicText}>Connected: { this.state.connected }</Text>
        <View style={styles.center}>
          <Image
            source={ this.state.icon }
            style={styles.imageLocker}
          />
        </View>
        <View style={styles.buttonView1}>
          <Button disabled={this.state.buttonDisabled}
            onPress={this.toggleLocker.bind(this, "unlock")}
            title="Unlock"
            style={styles.buttonAction}
          />
        </View>
        <View style={styles.buttonView2}>
          <Button disabled={this.state.buttonDisabled}
            onPress={this.toggleLocker.bind(this, "lock")}
            title="Lock"
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainToolbar:{
    padding: 20,
    flexDirection:'row'
  },
  mainToolbarTitle:{
    textAlign:'center',
    fontWeight:'bold',
    fontSize: 22,
    flex:1,
    marginTop:6
  },
  dynamicText:{
    textAlign:'center',
    fontWeight:'bold',
    fontSize: 22,
    paddingBottom: 20
  },
  toolbar:{
    padding: 20,
    flexDirection:'row'
  },
  toolbarButton:{
    width: 50
  },
  toolbarTitle:{
    textAlign:'center',
    fontSize: 18,
    flex:1
  },
  deviceName: {
    fontSize: 17,
    color: "black"
  },
  deviceNameWrap: {
    margin: 10,
    borderBottomWidth:1
  },
  imageLocker: {
    width: 150,
    height: 150,
    marginBottom: 30
  },
  buttonView1: {
    width: "50%",
    marginBottom: 10,
    marginLeft: "25%"
  },
  buttonView2: {
    width: "50%",
    paddingBottom: 20,
    marginLeft: "25%"
  }
});