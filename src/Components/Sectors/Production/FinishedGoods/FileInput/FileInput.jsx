import React, { useRef, useState } from "react";
import { Button, Grid, TextField } from "@mui/material";

const FileInput = ({ onChange, name, label }) => {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  const onFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName("");
    }
    onChange(e);
  };

  const activateInput = () => inputRef.current?.click();

  return (
    <>
      <input
        style={{ display: "none" }}
        type="file"
        name={name}
        onChange={onFileChange}
        ref={inputRef}
      />
      <Grid
        container
        direction="row"
        justifyContent={"space-between"}
        spacing={2}
        alignItems="center"
      >
        <Grid item xs="auto">
          <TextField
            size="small" // ниже/компактнее
            label={label}
            value={fileName}
            onClick={activateInput}
            disabled
            sx={{
              maxWidth: 260, // уже по ширине (подбери под себя)
              "& .MuiInputBase-input": {
                padding: "6px 10px", // ещё компактнее по высоте
                fontSize: 14,
              },
              "& .MuiInputLabel-root": {
                fontSize: 13,
              },
            }}
          />
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            size="small"
            onClick={activateInput}
            sx={{
              backgroundColor: "#ffd400",
              color: "#000", // чтобы текст был читаемым
              "&:hover": {
                backgroundColor: "#e6c200", // чуть темнее при наведении
              },
            }}
          >
            Выбрать файл
          </Button>
        </Grid>
      </Grid>
    </>
  );
};

export default FileInput;
