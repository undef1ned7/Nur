import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { fetchDepartmentsAsync } from '../../store/creators/departmentCreators';
import styles from './DepartmentAnalyticsChart.module.scss'; // Import the SCSS module

// Register the components and scales required for Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function DepartmentAnalyticsChart() {
  const dispatch = useDispatch();
  // Access the entire state for departments, assuming it holds the paginated object.
  // We'll then destructure `results` from `departmentData.data`
  const { list: departmentResponse = { results: [] }, status, error } = useSelector((state) => state.departments);

  // console.log(departmentResponse, 'departmentResponse');
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  

  useEffect(() => {
    dispatch(fetchDepartmentsAsync());
  }, [dispatch]);

  useEffect(() => {
    // Extract the actual array of departments from the 'results' key
    const departmentData = departmentResponse.results || [];
    // console.log(departmentData, 'departmentData');
    // console.log(status);
    
    if (departmentData.length > 0) {
      const aggregatedData = {};

      departmentData.forEach(dept => {
        // 'analytics' is already an object, so no JSON.parse needed
        const analytics = dept.analytics;

        if (analytics) { // Ensure analytics object exists
          if (!aggregatedData[dept.name]) {
            aggregatedData[dept.name] = { name: dept.name, income: 0, expense: 0 };
          }
          // Access total from income and expense objects
          aggregatedData[dept.name].income += (analytics.income?.total || 0);
          aggregatedData[dept.name].expense += (analytics.expense?.total || 0);
        } else {
          console.warn(`Analytics data missing for department: ${dept.name}`);
        }
      });

      const departmentNames = Object.keys(aggregatedData);
      const incomeData = departmentNames.map(name => aggregatedData[name].income);
      const expenseData = departmentNames.map(name => aggregatedData[name].expense);

      setChartData({
        labels: departmentNames,
        datasets: [
          {
            label: 'Доход',
            data: incomeData,
            backgroundColor: '#82ca9d',
            borderRadius: 10,
          },
          {
            label: 'Расход',
            data: expenseData,
            backgroundColor: '#8884d8',
            borderRadius: 10,
          },
        ],
      });
    }
  }, [departmentResponse, status]); // Depend on the full departmentResponse and status

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
        text: 'Доход и Расход Отделов',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KGS' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Название Отдела',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        }
      },
      y: {
        title: {
          display: true,
          text: 'Сумма',
        },
        beginAtZero: true,
      },
    },
  };

  // Determine loading state based on Redux status
  const isLoading = status === 'loading';
  const isFailed = status === 'failed';
  const hasNoData = chartData.labels.length === 0 && !isLoading && !isFailed;

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Загрузка аналитических данных...</p>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorTitle}>Ошибка:</p>
        <p>{error}</p>
        <p className={styles.errorMessage}>Пожалуйста, проверьте консоль для более подробной информации или попробуйте снова позже.</p>
      </div>
    );
  }

  if (hasNoData) {
    return (
      <div className={styles.noDataContainer}>
        <p>Нет доступных аналитических данных для отображения.</p>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <Bar options={options} data={chartData} />
    </div>
  );
}

export default DepartmentAnalyticsChart;