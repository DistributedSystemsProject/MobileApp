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
var _ = require('lodash');

export default class App extends Component<{}> {
  constructor (props) {
    super(props)
    this.state = {
      icon: require('./src/images/locked.png'),
      isEnabled: false,
      discovering: false,
      devices: [],
      unpairedDevices: []
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
    BluetoothSerial.connect(device.id)
    .then((res) => {
      console.log(`Connesso al dispositivo ${device.name}`);
      ToastAndroid.show(`Connesso al dispositivo ${device.name}`, ToastAndroid.SHORT);
    })
    .catch((err) => console.log((err.message)))
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
            console.log("Id dispositivo " + receivedId);
          } else {
            //Otherwise, the message
            receivedMessage = receivedData;
            console.log("Messaggio ricevuto " + receivedMessage);
          }
        } else {
          //At the second step, the client receives the response from the device
            console.log("Risposta ricevuta " + receivedData);
          this.sendToServer(receivedData);
        }
      });
    });
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

  //Reset to the first step, according to the pushed button
  openLocker(){
    savedTicket = "";
    this.authorizeOperation("unlock");
  }
  closeLocker(){
    savedTicket = "";
    this.authorizeOperation("lock");
  }

  //The client contacts the server to be authorized
  authorizeOperation(typeOperation) {
    console.log(idClient);
    console.log(receivedId);
    console.log(pwdClient);
    console.log(typeOperation);
    console.log(receivedMessage);
    fetch('https://www.minecrime.it:8888/authorize-operation', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: idClient,
        device_id: receivedId,
        client_pass: pwdClient,
        operation: typeOperation,
        load: receivedMessage
      })
    }).then((response) => response.json())
    .then((json) => {
      console.log(json);
      var serverResponse = json;
      savedTicket = json.ticket;
      this.sendToDevice(serverResponse.load, typeOperation);
    })
    .catch((error) => {
      console.error(error);
    });
  }

  //The operation and its authorization are sent to the device
  sendToDevice(otp, operation){
    console.log(otp);
    BluetoothSerial.write(otp)
    .then((res) => {
      console.log(res);
      ToastAndroid.show(`Operazione effettuata`, ToastAndroid.SHORT);
      if (operation=="lock") {
        this.setState({ icon: require('./src/images/locked.png') });
      } else if (operation=="unlock") {
        this.setState({ icon: require('./src/images/unlocked.png') });
      }
    })
    .catch((err) => console.log(err.message))
  }

  //The response is sent to the server, through the saved ticket
  sendToServer(receivedData) {
    fetch('https://www.minecrime.it:8888/result', {
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
      console.log(serverResponse.load);
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
          <Text style={styles.toolbarTitle}>Attiva/Disattiva Bluetooth</Text>
          <View style={styles.toolbarButton}>
            <Switch
              value={this.state.isEnabled}
              onValueChange={(val) => this.toggleBluetooth(val)}
            />
          </View>
        </View>
        <Button
          onPress={this.discoverAvailableDevices.bind(this)}
          title="Trova dispositivi"
        />
        <FlatList
          style={{flex:1}}
          data={this.state.devices}
          keyExtractor={item => item.id}
          renderItem={(item) => this._renderItem(item)}
        />
        <View style={styles.center}>
          <Image
            source={ this.state.icon }
            style={styles.imageLocker}
          />
        </View>
        <View style={styles.buttonView1}>
          <Button
            onPress={this.openLocker.bind(this)}
            title="Apri"
            style={styles.buttonAction}
          />
        </View>
        <View style={styles.buttonView2}>
          <Button
            onPress={this.closeLocker.bind(this)}
            title="Chiudi"
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
    width: 200,
    height: 200,
    marginBottom: 50
  },
  buttonView1: {
    width: "50%",
    marginBottom: 10,
    marginLeft: "25%"
  },
  buttonView2: {
    width: "50%",
    paddingBottom: 40,
    marginLeft: "25%"
  }
});