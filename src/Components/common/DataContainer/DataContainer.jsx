import React from 'react'
import styles from './container.module.scss'


export default function DataContainer({ children }) {
  
  return (
    <div className={styles.datacontainer}>
      {children}
    </div>
  )
}
