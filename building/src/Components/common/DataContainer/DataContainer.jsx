import React from 'react'
import styles from './container.module.scss'


export default function DataContainer({ children, className =''}) {
  
  return (
    <div className={`${styles.datacontainer} ${className}`}>
      {children}
    </div>
  )
}
