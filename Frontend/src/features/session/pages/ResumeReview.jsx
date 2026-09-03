import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  getResumeById,
  structureResumeData,
  updateResumeData,
  createSession,
} from "../services/session.api";
import "../style/resume-review.scss";

const ResumeReview = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [targetRole, setTargetRole] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [companyStyle, setCompanyStyle] = useState("");

  const [skills, setSkills] = useState([]);
  const [newSkillText, setNewSkillText] = useState("");

  const [projects, setProjects] = useState([]);
  const [experience, setExperience] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadAndStructureResume() {
      try {
        setLoading(true);
        setError("");

        // Fetch resume document
        const resumeRes = await getResumeById(resumeId);
        const resume = resumeRes.resume;

        if (isMounted) {
          setTargetRole(resume.targetRole || "");
          setTargetDomain(resume.targetDomain || "");
          setCompanyStyle(resume.companyStyle || "");
        }

        let structured = resume.structuredData;

        // If structuredData doesn't exist yet, call the structure endpoint
        if (
          !structured ||
          (!structured.skills?.length &&
            !structured.projects?.length &&
            !structured.experience?.length)
        ) {
          const structRes = await structureResumeData(resumeId);
          structured = structRes.structuredData;
        }

        if (isMounted && structured) {
          setSkills(Array.isArray(structured.skills) ? structured.skills : []);
          setProjects(
            Array.isArray(structured.projects) ? structured.projects : [],
          );
          setExperience(
            Array.isArray(structured.experience) ? structured.experience : [],
          );
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load and structure resume.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (resumeId) {
      loadAndStructureResume();
    }

    return () => {
      isMounted = false;
    };
  }, [resumeId]);

  // Skill Handlers
  const handleAddSkill = () => {
    const trimmed = newSkillText.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillText("");
    }
  };

  const handleRemoveSkill = (indexToRemove) => {
    setSkills(skills.filter((_, idx) => idx !== indexToRemove));
  };

  // Project Handlers
  const handleProjectChange = (index, field, value) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  };

  const handleAddProject = () => {
    setProjects([
      ...projects,
      { name: "New Project", description: "", technologies: "" },
    ]);
  };

  const handleRemoveProject = (indexToRemove) => {
    setProjects(projects.filter((_, idx) => idx !== indexToRemove));
  };

  // Experience Handlers
  const handleExperienceChange = (index, field, value) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    setExperience(updated);
  };

  const handleAddExperience = () => {
    setExperience([
      ...experience,
      { role: "Role Title", company: "Company Name", description: "" },
    ]);
  };

  const handleRemoveExperience = (indexToRemove) => {
    setExperience(experience.filter((_, idx) => idx !== indexToRemove));
  };

  // Save and Continue
  const handleConfirmAndContinue = async () => {
    try {
      setSaving(true);
      setError("");

      const structuredData = {
        skills,
        projects,
        experience,
      };

      await updateResumeData(resumeId, {
        structuredData,
        targetRole,
        targetDomain,
        companyStyle,
      });

      // Create session & generate question #1, then navigate to live interview screen
      const sessionRes = await createSession({ resumeId });
      const sessionId = sessionRes?.sessionId || sessionRes?.session?._id;

      if (sessionId) {
        navigate(`/session/live/${sessionId}`);
      } else {
        navigate(`/`);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save resume edits and start session.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="resume-review-page">
        <div className="review-loading">
          <h2>Analyzing & Structuring Resume...</h2>
          <p>Extracting skills, projects, and work experience with Gemini AI.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="resume-review-page">
      <div className="review-container">
        <header className="review-header">
          <div>
            <div className="review-header__eyebrow">
              Live Interview Prep &bull; Step 1 of 3
            </div>
            <h1>Review &amp; Refine Resume Data</h1>
            <p>
              Gemini has structured your resume. Review and edit any field below so
              your interview questions are accurate.
            </p>
          </div>
        </header>

        {error && <p className="form-error">{error}</p>}

        {/* Target Parameters */}
        <section className="review-card">
          <div className="review-card__title">
            <h2>Target Parameters</h2>
          </div>
          <div className="item-box">
            <div className="row-grid">
              <div>
                <label className="section-label">Target Role</label>
                <input
                  type="text"
                  className="input-field"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Fullstack Engineer"
                />
              </div>
              <div>
                <label className="section-label">Target Domain</label>
                <input
                  type="text"
                  className="input-field"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  placeholder="e.g. FinTech / SaaS"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Skills Section */}
        <section className="review-card">
          <div className="review-card__title">
            <h2>Extracted Skills ({skills.length})</h2>
          </div>
          <div className="skills-wrapper">
            {skills.map((skill, index) => (
              <span key={index} className="editable-skill-tag">
                {skill}
                <button
                  type="button"
                  className="editable-skill-tag__remove"
                  onClick={() => handleRemoveSkill(index)}
                  title="Remove skill"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="add-input-group">
            <input
              type="text"
              placeholder="Add new skill..."
              value={newSkillText}
              onChange={(e) => setNewSkillText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddSkill}
            >
              + Add Skill
            </button>
          </div>
        </section>

        {/* Projects Section */}
        <section className="review-card">
          <div className="review-card__title">
            <h2>Key Projects ({projects.length})</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddProject}
            >
              + Add Project
            </button>
          </div>

          <div className="card-item-list">
            {projects.map((proj, index) => (
              <div key={index} className="item-box">
                <div className="item-box__header">
                  <span className="badge badge--best">Project #{index + 1}</span>
                  <button
                    type="button"
                    className="item-box__remove"
                    onClick={() => handleRemoveProject(index)}
                  >
                    Delete Project
                  </button>
                </div>
                <div className="row-grid">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Project Name"
                    value={proj.name || ""}
                    onChange={(e) =>
                      handleProjectChange(index, "name", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Technologies (e.g. React, Node.js, AWS)"
                    value={proj.technologies || ""}
                    onChange={(e) =>
                      handleProjectChange(index, "technologies", e.target.value)
                    }
                  />
                </div>
                <textarea
                  className="textarea-field"
                  placeholder="Project summary and impact..."
                  value={proj.description || ""}
                  onChange={(e) =>
                    handleProjectChange(index, "description", e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </section>

        {/* Experience Section */}
        <section className="review-card">
          <div className="review-card__title">
            <h2>Work Experience ({experience.length})</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddExperience}
            >
              + Add Experience
            </button>
          </div>

          <div className="card-item-list">
            {experience.map((exp, index) => (
              <div key={index} className="item-box">
                <div className="item-box__header">
                  <span className="badge badge--best">Role #{index + 1}</span>
                  <button
                    type="button"
                    className="item-box__remove"
                    onClick={() => handleRemoveExperience(index)}
                  >
                    Delete Role
                  </button>
                </div>
                <div className="row-grid">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Role Title"
                    value={exp.role || ""}
                    onChange={(e) =>
                      handleExperienceChange(index, "role", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Company Name"
                    value={exp.company || ""}
                    onChange={(e) =>
                      handleExperienceChange(index, "company", e.target.value)
                    }
                  />
                </div>
                <textarea
                  className="textarea-field"
                  placeholder="Responsibilities and key contributions..."
                  value={exp.description || ""}
                  onChange={(e) =>
                    handleExperienceChange(index, "description", e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </section>

        {/* Confirm Action */}
        <div className="review-actions">
          <button
            type="button"
            className="confirm-btn"
            disabled={saving}
            onClick={handleConfirmAndContinue}
          >
            {saving ? "Saving Edits..." : "Confirm & Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeReview;
