import React, { useEffect, useState, useRef } from 'react'
import { 
  StyleSheet, 
  Text, 
  View,
  Dimensions,
  TextInput,
  ScrollView,
  Image,
  Animated as AnimatedReact,
  TouchableOpacity,
  useWindowDimensions
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useAnimatedGestureHandler, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { PanGestureHandler } from 'react-native-gesture-handler'

import * as Location from 'expo-location'

import MapView, {PROVIDER_GOOGLE} from 'react-native-maps'
import axios from 'axios'

import { Ionicons } from '@expo/vector-icons'

const API_KEY = process.env.API_KEY
const { width, height } = Dimensions.get('window')
const CARD_HEIGHT = 220
const CARD_WIDTH = width * 0.8
const SPACING_FOR_CARD_INSET = width * 0.1 - 10

export default function App() {
  const [nearPlace, setNearPlace] = useState(null)
  const [myLocation, setMyLocation] = useState(null)

  const [locations, setLocations] = useState([])
  const [geoName, setGeoName] = useState('')
  const [placeClicked, setPlaceClicked] = useState()

  const SPRING_CONFIG = {
    damping: 80,
    overshootClamping: true,
    restDisplacementThreshold: 0.1,
    restSpeedThreshold: 0.1,
    stiffness: 500
  }

  const dimensions = useWindowDimensions()
  const top = useSharedValue(
    dimensions.height
  )
  const style = useAnimatedStyle(() => {
    return {
      top: withSpring(top.value + 50, SPRING_CONFIG)
    }
  }) 
  const gestureHandler = useAnimatedGestureHandler({
    onStart(_, context) {
      context.startTop = top.value
    },
    onActive(event, context) {
      top.value = context.startTop + event.translationY
    },
    onEnd() {
      if (top.value > dimensions.height / 3 + 200) {
        top.value = dimensions.height
      } else {
        top.value = dimensions.height / 3
      }
    }
  })
  
  const apiGet = async (method, query) => {
    let url = `https://api.opentripmap.com/0.1/en/places/${method}?apikey=${API_KEY}`

    if (query !== undefined) {
      url += '&' + query
    }

    const getPlace = await axios.get(url)

    return getPlace
  }

  const getNearLocationApi = async (longitude, latitude) => {
    const places = await apiGet('radius', `radius=1000&limit${5}&offset=${0}&lon=${longitude}&lat=${latitude}&rate=3&format=json`)

    return places
  }

  console.log(myLocation)

  let mapIndex = 0
  let mapAnimation = new AnimatedReact.Value(0)

  useEffect(() => {
    async function getDataFromApi() {
      let { status } = await Location.requestForegroundPermissionsAsync()
      
      let location = await Location.getCurrentPositionAsync({})
      const coordinateMyLocations = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04864195044303443,
        longitudeDelta: 0.040142817690068,
      }
      setMyLocation(coordinateMyLocations)

      const getNearPlace = await getNearLocationApi(location.coords.longitude, location.coords.latitude)
      setNearPlace(getNearPlace.data)

      const locations = getNearPlace.data.filter((place) => place.name !== '')
      locations?.map(async (location) => {
        const place = await apiGet("xid/" + location.xid)

        setLocations({ locations, ...place.data })
      })
    }

    if (myLocation === null) {
      getDataFromApi()
    }
      

      mapAnimation.addListener(({ value }) => {
        let index = Math.floor(value / CARD_WIDTH + 0.3)
        if (index >= locations.length) {
          index = locations.length - 1
        }
        if (index <= 0) {
          index = 0
        }

        clearTimeout(regionTimeout)

        const regionTimeout = setTimeout(() => {
          if (mapIndex !== index) {
            mapIndex = index
            const { point } = locations[index]
            _map.current.animateToRegion(
              {
                latitude: point.lat,
                longitude: point.lon,
                latitudeDelta: 0.004864195044303443,
                longitudeDelta: 0.004864195044303443
              },
              350
            )
          }
        }, 10);
      })
  })

  const interpolations = nearPlace?.map((marker, index) => {
    const inputRange = [
      (index - 1) * CARD_WIDTH,
      index * CARD_WIDTH,
      ((index + 1) * CARD_WIDTH),
    ]

    const scale = mapAnimation.interpolate({
      inputRange,
      outputRange: [1, 1.5, 1],
      extrapolate: "clamp"
    })

    return { scale }
  })

  const _map = useRef(null)
  const _scrollView = useRef(null)

  const handleSearch = async () => {
    try {
      const location = await apiGet('geoname', `name=${geoName}`)
      const getNearPlace = await getNearLocationApi(location.data.lon, location.data.lat)
      const coordinateMyLocations = {
        latitude: location.data.lat,
        longitude: location.data.lon,
        latitudeDelta: 0.004864195044303443,
        longitudeDelta: 0.0040142817690068,
      }
      _map.current.animateToRegion(coordinateMyLocations, 350)
      setMyLocation(coordinateMyLocations)
      setNearPlace(getNearPlace.data)
      const locationsData = getNearPlace.data.slice(0, 6)
      const locations = locationsData?.map(async (location) => {
        const place = await apiGet("xid/" + location.xid)

        return place.data
      })

      const results = await Promise.all(locations)
      setLocations(results.map(result => result))
    } catch (error) {
      console.log(error.message);
    }
  }

  const BottomSheet = () => {

    console.log(placeClicked);

    return (
      <PanGestureHandler
        onGestureEvent={gestureHandler}
      >
        <Animated.View
          style={[styles.sheetBottom, style]}
        >
          <View style={styles.sheetContainer}>
            <Image
              source={{ uri: placeClicked.preview.source }}
              style={{
                width: 500,
                height: 200
              }}
              resizeMode="cover"
            />
            <Text style={styles.clickedTitle}>{placeClicked.name}</Text>
            <View>
              <View style={{
                fontSize: 8,
                marginBottom: 2
              }}>
                <Text>{placeClicked.address.road}, {placeClicked.address.city_district}</Text>
                <Text>{placeClicked.address.village}, {placeClicked.address.state_district}</Text>
                <Text>{placeClicked.address.country}, {placeClicked.address.postcode}</Text>
              </View>
            </View>
            <Text numberOfLines={6} style={styles.cardDescription}>{placeClicked.wikipedia_extracts.text}</Text>
          </View>
        </Animated.View>
      </PanGestureHandler>
    )
  }

  return (
    <>
      <View style={styles.container}>
        {myLocation && <MapView
          ref={_map}
          initialRegion={myLocation}
          style={styles.container}
          provider={PROVIDER_GOOGLE}
        >
          <MapView.Marker coordinate={myLocation}>
            <AnimatedReact.View>
              <Image
                source={require('./assets/map_marker.png')}
                style={styles.marker}
                resizeMode="cover"
              />
            </AnimatedReact.View>
          </MapView.Marker>

          {nearPlace && nearPlace.map((place, index) => {
            const scaleStyle = {
              transform: [
                {
                  scale: interpolations[index].scale
                }
              ]
            }

            const coordinate = {
              latitude: place.point.lat,
              longitude: place.point.lon
            }

            return (
              <MapView.Marker key={place.xid} coordinate={coordinate}>
                <AnimatedReact.View style={[styles.markerWrap]}>
                  <AnimatedReact.Image
                    source={require('./assets/map_marker.png')}
                    style={[styles.marker, scaleStyle]}
                    resizeMode="cover"
                  />
                </AnimatedReact.View>
              </MapView.Marker>
            )
          })}
        </MapView>
        }
        
        <View style={styles.searchInput}>
          <TextInput
            placeholder="Search here"
            placeholderTextColor="#000"
            autoCapitalize="none"
            onChangeText={text => setGeoName(text)}
            value={geoName}
            onSubmitEditing={handleSearch}
            style={{flex:1,padding:0}}
          />
          <Ionicons name="ios-search" size={20} />
        </View>

        <AnimatedReact.ScrollView
          ref={_scrollView}
          horizontal
          pagingEnabled
          scrollEventThrottle={1}
          showsHorizontalScrollIndication={false}
          snapToInterval={CARD_WIDTH + 20}
          style={styles.scrollView}
          snapToAlignment="center"
          contentInset={{
            top: 0,
            left: SPACING_FOR_CARD_INSET,
            bottom: 0,
            right: SPACING_FOR_CARD_INSET
          }}
          contentContainerStyle={{
            paddingHorizontal: Platform.OS === 'android' ? SPACING_FOR_CARD_INSET : 0
          }}
          onScroll={AnimatedReact.event(
          [
            {
              nativeEvent: {
                contentOffset: {
                  x: mapAnimation,
                }
              },
            },
          ],
          {useNativeDriver: true}
        )}
        >
          {locations.length >= 1 && locations.map(place => (
            <TouchableOpacity 
              key={place.xid} 
              onPress={() => {
                top.value = withSpring(
                  dimensions.height / 3,
                  SPRING_CONFIG
                )
                setPlaceClicked(place)
              }}
            >
              <View style={styles.card}>
                <Image
                  source={{uri: place.preview.source}}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.textContent}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{place.name}</Text>
                  <Text numberOfLines={2} style={styles.cardDescription}>{place.wikipedia_extracts.text}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )
          )}
        </AnimatedReact.ScrollView>
      </View>
      {placeClicked && <BottomSheet />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  marker: {
    width: 30,
    height: 30,
  },
  markerWrap: {
    alignItems: "center",
    justifyContent: "center",
    width:50,
    height:50,
  },
  searchInput: {
    position: 'absolute',
    top: 20,
    marginHorizontal: 5,
    marginTop: 20,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#ccc',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10
  },
  scrollView: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    paddingVertical: 10
  },
  card: {
    elevation: 2,
    backgroundColor: '#fff',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowRadius: 5,
    shadowOpacity: 0.3,
    shadowOffset: { x: 2, y: -2 },
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
    overflow: "hidden",
  },
  cardImage: {
    flex: 3,
    width: "100%",
    height: "100%",
    alignSelf: "center",
  },
  textContent: {
    flex: 2,
    padding: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2
  },
  cardDescription: {
    fontSize: 12
  },
  sheetBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.8,
    elevation: 15,
    padding: 20,
  },
  sheetContainer: {
    width: '100%',
    overflow: 'hidden'
  },
  clickedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8
  }
});

