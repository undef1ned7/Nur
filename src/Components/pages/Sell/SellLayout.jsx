import { Button } from '@mui/material'
import React, { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

export default function SellLayout() {
    const location = useLocation()
    const { text, path } = useMemo(() => {
        let isHistoryLocatin = location.pathname.split('/').map(el => el.trim()).filter(Boolean).at(-1) === 'start';
        let text = !isHistoryLocatin ? 'Продажи' : 'Назад'
        let path = isHistoryLocatin ? '' : 'start'
        return {
            isHistoryLocatin,
            path,
            text
        }
    }, [location?.pathname])
    return (
        <>
            <div className='flex gap-x-5 gap-y-2 flex-wrap'>
                {/* <NavLink className={({ isActive }) => {
                    let baseClass = 'flex-1 w-full'
                    if (isActive) {
                        baseClass += ' group'
                    }
                    return baseClass
                }}>
                    <Button className='group-bg-red-500! w-full text-nowrap' color='warning' variant='contained'>Заказы</Button>
                </NavLink> */}
                <NavLink
                    to={path}
                    className={'flex-1 w-full'}
                >
                    <Button
                        className='w-full'
                        color='warning'
                        variant='contained'
                    >
                        {text}
                    </Button>
                </NavLink>
            </div>
            <Outlet />
        </>
    )
}
