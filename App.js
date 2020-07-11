import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  Button,
  FlatList,
  Switch,
  TouchableOpacity,
  ToastAndroid
} from 'react-native';
import BluetoothSerial from 'react-native-bluetooth-serial'

var receivedId;
var receivedMessage;
var serverResponse;
var _ = require('lodash');

export default class App extends Component<{}> {
  constructor (props) {
    super(props)
    this.state = {
      isEnabled: false,
      discovering: false,
      devices: [],
      unpairedDevices: [],
      connected: false,
    }
  }
  componentDidMount(){

    Promise.all([
      BluetoothSerial.isEnabled(),
      BluetoothSerial.list()
    ])
    .then((values) => {
      const [ isEnabled, devices ] = values

      this.setState({ isEnabled, devices })
    })

    BluetoothSerial.on('bluetoothEnabled', () => {

      Promise.all([
        BluetoothSerial.isEnabled(),
        BluetoothSerial.list()
      ])
      .then((values) => {
        const [ isEnabled, devices ] = values
        this.setState({  devices })
      })

      BluetoothSerial.on('bluetoothDisabled', () => {

         this.setState({ devices: [] })

      })
      BluetoothSerial.on('error', (err) => console.log(`Error: ${err.message}`))

    })

  }
  connect (device) {
    this.setState({ connecting: true })
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
        console.log('Dati ricevuti: ${data.data}');
        receivedData = data.data;
        //Se è lungo 16 significa che è l'id iniziale del device, altrimenti è il messaggio
        if (receivedData.length == 16) {
          receivedId = receivedData;
          ToastAndroid.show(`Connesso al dispositivo ${receivedId}`, ToastAndroid.SHORT);
          console.log("Id dispositivo: ${receivedId}")
        } else {
          receivedMessage = receivedData;
          ToastAndroid.show(`Connesso al dispositivo ${receivedMessage}`, ToastAndroid.SHORT);
          console.log("Id dispositivo: ${receivedMessage}")
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
  enable () {
    BluetoothSerial.enable()
    .then((res) => this.setState({ isEnabled: true }))
    .catch((err) => Toast.showShortBottom(err.message))
  }

  disable () {
    BluetoothSerial.disable()
    .then((res) => this.setState({ isEnabled: false }))
    .catch((err) => Toast.showShortBottom(err.message))
  }

  toggleBluetooth (value) {
    if (value === true) {
      this.enable()
    } else {
      this.disable()
    }
  }

  discoverAvailableDevices () {
    if (this.state.discovering) {
      return false
    } else {
      this.setState({ discovering: true })
      BluetoothSerial.discoverUnpairedDevices()
      .then((unpairedDevices) => {
        const uniqueDevices = _.uniqBy(unpairedDevices, 'id');
        console.log(uniqueDevices);
        this.setState({ unpairedDevices: uniqueDevices, discovering: false })
      })
      .catch((err) => console.log(err.message))
    }
  }

  //In base al bottone premuto, viene scelta l'operazione da fare
  toggleSwitch(){
    //console.log(operation);
    this.authorizeOperation("lock");
  }

  //Se autenticato, vengono inviati i dati al dispositivo
  sendToDevice(stuff){
    BluetoothSerial.write(stuff)
    .then((res) => {
      console.log(res);
      ToastAndroid.show('Operazione riuscita', ToastAndroid.SHORT);
      this.setState({ connected: true })
    })
    .catch((err) => console.log(err.message))
  }

  //Il client contatta il server per vedere se può effettuare operazioni
  authorizeOperation(typeOperation) {
    fetch('https://minecrime.it:8888/authorize-operation', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        /*client_id: "1234567890client",
        device_id: receivedId,
        client_pass: "clientpass",
        operation: typeOperation,
        load: receivedMessage*/
        client_id: "1234567890client",
        device_id: "1234567890device",
        client_pass: "clientpass",
        operation: typeOperation,
        load: "LtqED6LEbQLJicZXjwEZmeO4KnkSrtQ4gTGDNwyWhw5ztacq8ZULjjz4WHlRm5qs1+XbgrB2dCGhllKIrxsfmmvLePSwymhu7m2GvAxmhwPMmjevo8PiALCTCPSnM2nQ52DZbS3Mn3Ha8d9Ivv4JvA=="
      })
    }).then((response) => response.json())
    .then((json) => {
      serverResponse = json;
      console.log(serverResponse);
      this.sendToDevice(serverResponse);
    })
    .catch((error) => {
      console.error(error);
    });
  }

  render() {
    return (
      <View style={styles.container}>
      <View style={styles.toolbar}>
            <Text style={styles.toolbarTitle}>Lista dispositivi Bluetooth</Text>
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
          color="#841584"
        />
        <FlatList
          style={{flex:1}}
          data={this.state.devices}
          keyExtractor={item => item.id}
          renderItem={(item) => this._renderItem(item)}
        />
        <Button
          onPress={this.toggleSwitch.bind(this)}
          title="Apri"
          color="#841584"
        />
        <Button
          onPress={this.toggleSwitch.bind(this)}
          title="Chiudi"
          color="#841584"
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  toolbar:{
    paddingTop:30,
    paddingBottom:30,
    flexDirection:'row'
  },
  toolbarButton:{
    width: 50,
    marginTop: 8,
  },
  toolbarTitle:{
    textAlign:'center',
    fontWeight:'bold',
    fontSize: 20,
    flex:1,
    marginTop:6
  },
  deviceName: {
    fontSize: 17,
    color: "black"
  },
  deviceNameWrap: {
    margin: 10,
    borderBottomWidth:1
  }
});