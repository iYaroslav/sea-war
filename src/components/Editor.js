import { useCallback, useMemo, useEffect } from 'react'
import {Button, Container, Stack} from '@mui/material'
import RoomMembers from './RoomMembers'
import { db, useAuth } from '../firabase'
import Sea from './Sea'

const allowed = {
  '4': 2,
  '3': 4,
  '2': 6,
  '1': 8,
}

function haveCollisions(matrix, x, y, mapSize) {
  if (y > 0 && x > 0 && matrix[y - 1][x - 1]) return true
  if (y > 0 && x < mapSize - 1 && matrix[y - 1][x + 1]) return true
  if (y < mapSize - 1 && x < mapSize - 1 && matrix[y + 1][x + 1]) return true

  return !!(y < mapSize - 1 && x > 0 && matrix[y + 1][x - 1])
}

export default function Editor({ room, onAllUsersReady }) {
  const mapSize = 15

  const { user } = useAuth()
  const dbPath = useMemo(() => `/rooms/${ room.id }/users/${ user.uid }`, [room, user])
  const me = useMemo(() => room.users[user.uid], [room])

  const editShips = useCallback((x, y) => {
    if (me.ready) return

    const matrix = new Array(mapSize)
      .fill(0)
      .map(() => new Array(mapSize).fill(0))

    const out = me.ships || []
    out.forEach(({ coords }) => {
      coords.forEach(({ y, x }) => matrix[y][x] = 1)
    })

    matrix[y][x] = matrix[y][x] ? 0 : 1
    const ships = []

    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        if (matrix[y][x] && haveCollisions(matrix, x, y, mapSize)) {
          console.warn('Collision!', x, y)
          return
        }
      }
    }

    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        if (!matrix[y][x]) continue
        const coords = [{ x, y }]
        matrix[y][x] = 0

        if (x < mapSize - 1 && matrix[y][x + 1]) {
          let dx = x + 1
          while (dx < mapSize && matrix[y][dx]) {
            matrix[y][dx] = 0
            coords.push({ x: dx, y })
            dx++
          }
        }

        if (y < mapSize - 1 && matrix[y + 1][x]) {
          let dy = y + 1
          while (dy < mapSize && matrix[dy][x]) {
            matrix[dy][x] = 0
            coords.push({ x, y: dy })
            dy++
          }
        }

        ships.push({ coords })
      }
    }

    const counts = {}
    for (const ship of ships) {
      if (ship.coords.length > 4) return
      counts[ship.coords.length] = (counts[ship.coords.length] || 0) + 1
    }

    for (const key of Object.keys(counts)) {
      if (allowed[key] < counts[key]) return
    }

    db.update(dbPath, { ships })
  }, [me])

  useEffect(() => {
    if (!room || !room.users) return

    for (const user of Object.values(room.users)) {
      if (!user.ready) return
    }

    onAllUsersReady()
  }, [room, onAllUsersReady])

  return <Container component="main" maxWidth="sm">
    <RoomMembers room={ room } />

    <Sea
      showShips
      ships={ me.ships || [] }
      misses={[]}
      onFire={ editShips }
      active={ true }
      size={ 15 }
    />

    <Stack direction={'row'} justifyContent={'center'} spacing={2}>
      { !me.ready && <Button
        variant={ "contained" }
        size={ 'large' }
        disabled
        onClick={ () => {

        } }
      >Randomize</Button> }

      { me.ready ? <Button
        variant={ "contained" }
        color={'warning'}
        size={ 'large' }
        onClick={ () => db.update(dbPath, { ready: false }) }
      >Edit</Button> : <Button
        variant={ "contained" }
        size={ 'large' }
        onClick={ () => db.update(dbPath, { ready: true }) }
      >Ready</Button> }
    </Stack>
  </Container>
}
