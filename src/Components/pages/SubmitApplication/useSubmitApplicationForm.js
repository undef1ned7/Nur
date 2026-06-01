import { useState } from "react";
import { useDispatch } from "react-redux";
import { submitApplicationAsync } from "../../../store/creators/userCreators";

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  text: "",
};

function getSubmitErrorMessage(err) {
  if (typeof err === "string") return err;
  return (
    err?.message ||
    err?.detail ||
    (Array.isArray(err?.non_field_errors) && err.non_field_errors[0]) ||
    "Ошибка при оставлении запроса"
  );
}

export function useSubmitApplicationForm({
  onSuccess,
  resetOnSuccess = true,
} = {}) {
  const dispatch = useDispatch();

  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const cleaned = value.replace(/[^\d+]/g, "");
      setForm((prev) => ({ ...prev, phone: cleaned }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (payload) => {
    const data = payload ?? form;
    setSending(true);
    setError("");
    setOk(false);

    try {
      await dispatch(submitApplicationAsync(data)).unwrap();
      setOk(true);
      if (resetOnSuccess) {
        setForm(EMPTY_FORM);
      }
      onSuccess?.();
    } catch (err) {
      setError(getSubmitErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    await submit();
  };

  return {
    form,
    setForm,
    onChange,
    onFormSubmit,
    submit,
    sending,
    error,
    setError,
    ok,
  };
}
