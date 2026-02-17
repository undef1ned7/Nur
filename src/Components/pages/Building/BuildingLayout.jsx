import React from 'react'
import { Outlet } from 'react-router-dom'
import './style.scss'

export default function BuildingLayout() {
    return (
        <div className="building-layout">
            <Outlet />
        </div>
    )
}